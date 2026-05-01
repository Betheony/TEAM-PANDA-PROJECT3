import { NextRequest, NextResponse } from 'next/server';
import { PoolClient } from 'pg';
import pool from '@/lib/db';

const ORDER_TIME_ZONE = 'America/Chicago';

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

type IngredientNeed = {
  name: string;
  qty: number;
  contributors: Map<string, number>;
};

type OrderItemCustomizationSchema = {
  sizeColumn: string | null;
  sugarLevelColumn: string | null;
  iceLevelColumn: string | null;
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

function pickColumn(columns: Set<string>, candidates: string[]) {
  return candidates.find((column) => columns.has(column)) ?? null;
}

async function resolveOrderItemCustomizationSchema(
  client: DbClient
): Promise<OrderItemCustomizationSchema> {
  const orderItemColumns = await getTableColumns(client, 'order_items');

  return {
    sizeColumn: pickColumn(orderItemColumns, ['size']),
    sugarLevelColumn: pickColumn(orderItemColumns, ['sugar_level']),
    iceLevelColumn: pickColumn(orderItemColumns, ['ice_level']),
  };
}

function addIngredientNeed(
  needed: Map<number, IngredientNeed>,
  ingredientId: number,
  ingredientName: string,
  qty: number,
  contributorName: string
) {
  const prev = needed.get(ingredientId);
  const contributors = prev?.contributors ?? new Map<string, number>();
  contributors.set(contributorName, (contributors.get(contributorName) ?? 0) + qty);
  needed.set(ingredientId, {
    name: ingredientName,
    qty: (prev?.qty ?? 0) + qty,
    contributors,
  });
}

function orderItemSelectFields(schema: OrderItemCustomizationSchema) {
  return [
    `'order_items_id', oi.order_items_id`,
    `'menu_item_id', oi.menu_item_id`,
    `'menu_item_name', mi.name`,
    `'quantity', oi.quantity`,
    `'unit_price', oi.unit_price`,
    `'size', ${schema.sizeColumn ? `oi."${schema.sizeColumn}"` : `'medium'`}`,
    `'sugar_level', ${schema.sugarLevelColumn ? `oi."${schema.sugarLevelColumn}"` : `'100%'`}`,
    `'ice_level', ${schema.iceLevelColumn ? `oi."${schema.iceLevelColumn}"` : `'100%'`}`,
    `'toppings', (
      SELECT COALESCE(json_agg(json_build_object(
        'topping_id', t.topping_id,
        'name', t.name,
        'topping_qty', oit.topping_qty
      )), '[]'::json)
      FROM order_item_toppings oit
      JOIN topping t ON t.topping_id = oit.topping_id
      WHERE oit.order_items_id = oi.order_items_id
    )`,
  ];
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const customizationSchema = await resolveOrderItemCustomizationSchema(client);
      const result = await client.query(`
        SELECT
          o.order_id,
          to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE $1, 'FMMM/FMDD/YYYY, FMHH12:MI:SS AM') AS created_at,
          to_char((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE $1, 'FMHH12:MI AM') AS created_time,
          o.payment_method,
          o.order_status,
          COALESCE(json_agg(
            json_build_object(
              ${orderItemSelectFields(customizationSchema).join(',\n              ')}
            )
          ) FILTER (WHERE oi.order_items_id IS NOT NULL), '[]'::json) AS items
        FROM "order" o
        LEFT JOIN order_items oi ON oi.order_id = o.order_id
        LEFT JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
        GROUP BY o.order_id, o.created_at, o.payment_method, o.order_status
        ORDER BY o.created_at DESC
        LIMIT 200
      `, [ORDER_TIME_ZONE]);
      return NextResponse.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

async function insertOrderItem(
  client: DbClient,
  orderId: number,
  item: OrderPayload['items'][number],
  schema: OrderItemCustomizationSchema
) {
  const columns = ['order_id', 'menu_item_id', 'quantity', 'unit_price'];
  const values: Array<string | number> = [
    orderId,
    item.menu_item_id,
    item.quantity,
    item.unit_price,
  ];

  if (schema.sizeColumn) {
    columns.push(schema.sizeColumn);
    values.push(item.size ?? 'medium');
  }

  if (schema.sugarLevelColumn) {
    columns.push(schema.sugarLevelColumn);
    values.push(item.sugar_level ?? '100%');
  }

  if (schema.iceLevelColumn) {
    columns.push(schema.iceLevelColumn);
    values.push(item.ice_level ?? '100%');
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
    const needed = new Map<number, IngredientNeed>();

    for (const item of items) {
      const menuItemRows = await client.query(
        `SELECT name FROM menu_item WHERE menu_item_id = $1`,
        [item.menu_item_id]
      );
      const menuItemName = menuItemRows.rows[0]?.name ?? `Menu item #${item.menu_item_id}`;

      const recipeRows = await client.query(
        `SELECT r.ingredient_id, r.qty_needed, i.name
         FROM recipe r
         JOIN ingredient i ON i.ingredient_id = r.ingredient_id
         WHERE r.menu_item_id = $1`,
        [item.menu_item_id]
      );

      for (const row of recipeRows.rows) {
        addIngredientNeed(
          needed,
          row.ingredient_id,
          row.name,
          Number(row.qty_needed) * item.quantity,
          menuItemName
        );
      }

      for (const topping of item.toppings ?? []) {
        const toppingCount = Number(topping.topping_qty);
        if (!Number.isFinite(toppingCount) || toppingCount <= 0) continue;

        const toppingRows = await client.query(
          `SELECT t.name AS topping_name, t.qty_needed, t.ingredient_id, i.name AS ingredient_name
           FROM topping t
           JOIN ingredient i ON i.ingredient_id = t.ingredient_id
           WHERE t.topping_id = $1`,
          [topping.topping_id]
        );

        if (toppingRows.rows.length > 0) {
          const { ingredient_id, ingredient_name, topping_name, qty_needed } = toppingRows.rows[0];
          addIngredientNeed(
            needed,
            ingredient_id,
            ingredient_name,
            toppingCount * Number(qty_needed) * item.quantity,
            `${menuItemName} with ${topping_name}`
          );
        }
      }
    }

    if (needed.size > 0) {
      const stockRows = await client.query(
        `SELECT ingredient_id, name, qty_in_stock
         FROM ingredient
         WHERE ingredient_id = ANY($1)
         FOR UPDATE`,
        [Array.from(needed.keys())]
      );

      const insufficient: string[] = [];
      for (const row of stockRows.rows) {
        const required = needed.get(row.ingredient_id)!;
        if (row.qty_in_stock < required.qty) {
          const affectedDrinks = Array.from(required.contributors.keys()).join(', ');
          insufficient.push(
            `${required.name} for ${affectedDrinks} (need ${required.qty}, have ${row.qty_in_stock})`
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

    const orderResult = await client.query(
      `INSERT INTO "order" (payment_method, order_status)
       VALUES ($1, 'pending') RETURNING *`,
      [payment_method]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const orderItemsId = await insertOrderItem(
        client,
        order.order_id,
        item,
        customizationSchema
      );

      for (const topping of item.toppings ?? []) {
        const toppingCount = Number(topping.topping_qty);
        if (!Number.isFinite(toppingCount) || toppingCount <= 0) continue;

        await client.query(
          `INSERT INTO order_item_toppings (order_items_id, topping_id, topping_qty)
           VALUES ($1, $2, $3)`,
          [orderItemsId, topping.topping_id, toppingCount]
        );
      }
    }

    for (const [ingredientId, { qty }] of needed.entries()) {
      await client.query(
        `UPDATE ingredient SET qty_in_stock = qty_in_stock - $1 WHERE ingredient_id = $2`,
        [qty, ingredientId]
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
