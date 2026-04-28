import { NextRequest, NextResponse } from 'next/server';
import { PoolClient } from 'pg';
import pool from '@/lib/db';

type DbClient = PoolClient;

type OrderPayload = {
  payment_method: string;
  items: Array<{
    menu_item_id: number;
    quantity: number;
    unit_price: number;
    size?: string;
    sugar_level?: string;
    ice_level?: string;
    toppings?: Array<{
      topping_id: number;
      topping_qty: number;
    }>;
  }>;
};

type OrderItemCustomizationSchema = {
  hasSize: boolean;
  hasSugarLevel: boolean;
  hasIceLevel: boolean;
};

async function getTableColumns(client: DbClient, tableName: string) {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

async function resolveOrderItemCustomizationSchema(
  client: DbClient
): Promise<OrderItemCustomizationSchema> {
  const orderItemColumns = await getTableColumns(client, 'order_items');

  return {
    hasSize: orderItemColumns.has('size'),
    hasSugarLevel: orderItemColumns.has('sugar_level'),
    hasIceLevel: orderItemColumns.has('ice_level'),
  };
}

function normalizeDrinkCustomization(
  item: OrderPayload['items'][number],
  schema: OrderItemCustomizationSchema
) {
  return {
    size: schema.hasSize && ['medium', 'large'].includes(item.size ?? '')
      ? item.size
      : 'medium',
    sugar_level: schema.hasSugarLevel && ['0%', '50%', '100%'].includes(item.sugar_level ?? '')
      ? item.sugar_level
      : '100%',
    ice_level: schema.hasIceLevel && ['less ice', 'regular ice', 'more ice'].includes(item.ice_level ?? '')
      ? item.ice_level
      : 'regular ice',
  };
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const customizationSchema = await resolveOrderItemCustomizationSchema(client);
      const sizeField = customizationSchema.hasSize ? `'size', oi.size,` : `'size', 'medium',`;
      const sugarField = customizationSchema.hasSugarLevel ? `'sugar_level', oi.sugar_level,` : `'sugar_level', '100%',`;
      const iceField = customizationSchema.hasIceLevel ? `'ice_level', oi.ice_level,` : `'ice_level', 'regular ice',`;

      const result = await client.query(`
        SELECT
          o.order_id, o.created_at, o.payment_method, o.order_status,
          COALESCE(json_agg(
            json_build_object(
              'order_items_id', oi.order_items_id,
              'menu_item_id', oi.menu_item_id,
              'menu_item_name', mi.name,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              ${sizeField}
              ${sugarField}
              ${iceField}
              'toppings', (
                SELECT COALESCE(json_agg(json_build_object(
                  'topping_id', t.topping_id,
                  'name', t.name,
                  'topping_qty', oit.topping_qty
                )), '[]'::json)
                FROM order_item_toppings oit
                JOIN topping t ON t.topping_id = oit.topping_id
                WHERE oit.order_items_id = oi.order_items_id
              )
            )
          ) FILTER (WHERE oi.order_items_id IS NOT NULL), '[]'::json) AS items
        FROM "order" o
        LEFT JOIN order_items oi ON oi.order_id = o.order_id
        LEFT JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
        GROUP BY o.order_id, o.created_at, o.payment_method, o.order_status
        ORDER BY o.created_at DESC
        LIMIT 200
      `);
      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/*
  This query is kept above adaptive to the current database. If the order_items
  table has size, sugar_level, and ice_level columns, customizations persist.
  If not, orders still load with sensible default labels instead of crashing.
*/
async function insertOrderItem(
  client: DbClient,
  orderId: number,
  item: OrderPayload['items'][number],
  schema: OrderItemCustomizationSchema
) {
  const customization = normalizeDrinkCustomization(item, schema);
  const columns = ['order_id', 'menu_item_id', 'quantity', 'unit_price'];
  const values: Array<string | number> = [
    orderId,
    item.menu_item_id,
    item.quantity,
    item.unit_price,
  ];

  if (schema.hasSize) {
    columns.push('size');
    values.push(customization.size);
  }

  if (schema.hasSugarLevel) {
    columns.push('sugar_level');
    values.push(customization.sugar_level);
  }

  if (schema.hasIceLevel) {
    columns.push('ice_level');
    values.push(customization.ice_level);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const result = await client.query(
    `INSERT INTO order_items (${columns.join(', ')})
     VALUES (${placeholders}) RETURNING order_items_id`,
    values
  );

  return result.rows[0].order_items_id as number;
}

export async function POST(req: NextRequest) {
  const { items, payment_method }: OrderPayload = await req.json();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customizationSchema = await resolveOrderItemCustomizationSchema(client);

    // ── 1. Aggregate required ingredient quantities across all order items ──
    // Collect recipe requirements
    const needed = new Map<number, { name: string; qty: number }>();

    for (const item of items) {
      const recipeRows = await client.query(
        `SELECT r.ingredient_id, r.qty_needed, i.name
         FROM recipe r
         JOIN ingredient i ON i.ingredient_id = r.ingredient_id
         WHERE r.menu_item_id = $1`,
        [item.menu_item_id]
      );
      for (const row of recipeRows.rows) {
        const total = (row.qty_needed as number) * item.quantity;
        const prev = needed.get(row.ingredient_id);
        needed.set(row.ingredient_id, {
          name: row.name,
          qty: (prev?.qty ?? 0) + total,
        });
      }

      // Also collect topping requirements
      for (const topping of (item.toppings || [])) {
        const toppingRow = await client.query(
          `SELECT t.ingredient_id, i.name
           FROM topping t
           JOIN ingredient i ON i.ingredient_id = t.ingredient_id
           WHERE t.topping_id = $1`,
          [topping.topping_id]
        );
        if (toppingRow.rows.length > 0) {
          const { ingredient_id, name } = toppingRow.rows[0];
          const total = topping.topping_qty * item.quantity;
          const prev = needed.get(ingredient_id);
          needed.set(ingredient_id, {
            name,
            qty: (prev?.qty ?? 0) + total,
          });
        }
      }
    }

    // ── 2. Lock ingredient rows and check availability ──
    if (needed.size > 0) {
      const ingredientIds = Array.from(needed.keys());
      const stockRows = await client.query(
        `SELECT ingredient_id, name, qty_in_stock
         FROM ingredient
         WHERE ingredient_id = ANY($1)
         FOR UPDATE`,
        [ingredientIds]
      );

      const insufficient: string[] = [];
      for (const row of stockRows.rows) {
        const required = needed.get(row.ingredient_id)!;
        if (row.qty_in_stock < required.qty) {
          insufficient.push(
            `${required.name} (need ${required.qty}, have ${row.qty_in_stock})`
          );
        }
      }

      if (insufficient.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `Insufficient stock: ${insufficient.join('; ')}` },
          { status: 409 }
        );
      }
    }

    // ── 3. Insert the order and items ──
    const orderResult = await client.query(
      `INSERT INTO "order" (payment_method, order_status) VALUES ($1, 'pending') RETURNING *`,
      [payment_method]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const order_items_id = await insertOrderItem(client, order.order_id, item, customizationSchema);

      for (const topping of (item.toppings || [])) {
        await client.query(
          `INSERT INTO order_item_toppings (order_items_id, topping_id, topping_qty)
           VALUES ($1, $2, $3)`,
          [order_items_id, topping.topping_id, topping.topping_qty]
        );
      }
    }

    // ── 4. Deduct all ingredient stock in one pass ──
    for (const [ingredient_id, { qty }] of needed.entries()) {
      await client.query(
        `UPDATE ingredient SET qty_in_stock = qty_in_stock - $1 WHERE ingredient_id = $2`,
        [qty, ingredient_id]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  } finally {
    client.release();
  }
}
