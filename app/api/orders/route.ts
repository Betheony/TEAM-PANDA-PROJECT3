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
    ice_level?: string;
    sugar_level?: string;
    toppings?: Array<{
      topping_id: number;
      topping_qty: number;
    }>;
  }>;
};

type RecipeSchema = {
  ingredientColumn: string;
  menuItemColumn: string;
  quantityColumn: string;
} | null;

type OrderItemCustomizationSchema = {
  sizeColumn: string | null;
  iceLevelColumn: string | null;
  sugarLevelColumn: string | null;
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

async function resolveRecipeSchema(client: DbClient): Promise<RecipeSchema> {
  const recipeColumns = await getTableColumns(client, 'recipe');
  if (recipeColumns.size === 0) {
    return null;
  }

  const ingredientColumn = pickColumn(recipeColumns, ['ingredient_id']);
  const menuItemColumn = pickColumn(recipeColumns, ['menu_item_id']);
  const quantityColumn = pickColumn(recipeColumns, ['qty_needed', 'quantity', 'qty', 'amount']);

  if (!ingredientColumn || !menuItemColumn || !quantityColumn) {
    throw new Error('Recipe table exists but does not expose the expected inventory columns');
  }

  return {
    ingredientColumn,
    menuItemColumn,
    quantityColumn,
  };
}

async function resolveOrderItemCustomizationSchema(
  client: DbClient
): Promise<OrderItemCustomizationSchema> {
  const orderItemColumns = await getTableColumns(client, 'order_items');

  return {
    sizeColumn: pickColumn(orderItemColumns, ['size']),
    iceLevelColumn: pickColumn(orderItemColumns, ['ice_level']),
    sugarLevelColumn: pickColumn(orderItemColumns, ['sugar_level']),
  };
}

async function deductToppingInventory(
  client: DbClient,
  toppings: NonNullable<OrderPayload['items'][number]['toppings']>,
  itemQuantity: number
) {
  for (const topping of toppings) {
    await client.query(
      `UPDATE ingredient
       SET qty_in_stock = GREATEST(0, qty_in_stock - $1)
       WHERE ingredient_id = (
         SELECT ingredient_id
         FROM topping
         WHERE topping_id = $2
       )`,
      [topping.topping_qty * itemQuantity, topping.topping_id]
    );
  }
}

async function deductRecipeInventory(
  client: DbClient,
  recipeSchema: RecipeSchema,
  menuItemId: number,
  itemQuantity: number
) {
  if (!recipeSchema) {
    return;
  }

  const { ingredientColumn, menuItemColumn, quantityColumn } = recipeSchema;

  await client.query(
    `UPDATE ingredient AS i
     SET qty_in_stock = GREATEST(0, i.qty_in_stock - (r."${quantityColumn}" * $1))
     FROM recipe AS r
     WHERE r."${ingredientColumn}" = i.ingredient_id
       AND r."${menuItemColumn}" = $2`,
    [itemQuantity, menuItemId]
  );
}

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      const customizationSchema = await resolveOrderItemCustomizationSchema(client);
      const selectFields = [
        `'order_items_id', oi.order_items_id`,
        `'menu_item_id', oi.menu_item_id`,
        `'menu_item_name', mi.name`,
        `'quantity', oi.quantity`,
        `'unit_price', oi.unit_price`,
        `'size', ${
          customizationSchema.sizeColumn
            ? `oi."${customizationSchema.sizeColumn}"`
            : `'medium'`
        }`,
        `'ice_level', ${
          customizationSchema.iceLevelColumn
            ? `oi."${customizationSchema.iceLevelColumn}"`
            : `'100%'`
        }`,
        `'sugar_level', ${
          customizationSchema.sugarLevelColumn
            ? `oi."${customizationSchema.sugarLevelColumn}"`
            : `'100%'`
        }`,
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

      const result = await client.query(`
      SELECT
        o.order_id, o.created_at, o.payment_method, o.order_status,
        COALESCE(json_agg(
          json_build_object(
            ${selectFields.join(',\n            ')}
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

export async function POST(req: NextRequest) {
  const { items, payment_method }: OrderPayload = await req.json();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recipeSchema = await resolveRecipeSchema(client);
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
      const insertColumns = ['order_id', 'menu_item_id', 'quantity', 'unit_price'];
      const insertValues: Array<string | number> = [
        order.order_id,
        item.menu_item_id,
        item.quantity,
        item.unit_price,
      ];

      if (customizationSchema.iceLevelColumn) {
        insertColumns.push(customizationSchema.iceLevelColumn);
        insertValues.push(item.ice_level ?? '100%');
      }

      if (customizationSchema.sizeColumn) {
        insertColumns.push(customizationSchema.sizeColumn);
        insertValues.push(item.size ?? 'medium');
      }

      if (customizationSchema.sugarLevelColumn) {
        insertColumns.push(customizationSchema.sugarLevelColumn);
        insertValues.push(item.sugar_level ?? '100%');
      }

      const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');

      const itemResult = await client.query(
        `INSERT INTO order_items (${insertColumns.join(', ')})
         VALUES (${placeholders}) RETURNING order_items_id`,
        insertValues
      );
      const { order_items_id } = itemResult.rows[0];

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
