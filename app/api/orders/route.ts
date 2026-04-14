import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type DbClient = Awaited<ReturnType<typeof pool.connect>>;

type OrderPayload = {
  payment_method: string;
  items: Array<{
    menu_item_id: number;
    quantity: number;
    unit_price: number;
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
    const result = await pool.query(`
      SELECT
        o.order_id, o.created_at, o.payment_method, o.order_status,
        COALESCE(json_agg(
          json_build_object(
            'order_items_id', oi.order_items_id,
            'menu_item_id', oi.menu_item_id,
            'menu_item_name', mi.name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
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

    const orderResult = await client.query(
      `INSERT INTO "order" (payment_method, order_status) VALUES ($1, 'pending') RETURNING *`,
      [payment_method]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4) RETURNING order_items_id`,
        [order.order_id, item.menu_item_id, item.quantity, item.unit_price]
      );
      const { order_items_id } = itemResult.rows[0];

      for (const topping of (item.toppings || [])) {
        await client.query(
          `INSERT INTO order_item_toppings (order_items_id, topping_id, topping_qty)
           VALUES ($1, $2, $3)`,
          [order_items_id, topping.topping_id, topping.topping_qty]
        );
      }

      await deductToppingInventory(client, item.toppings || [], item.quantity);
      await deductRecipeInventory(client, recipeSchema, item.menu_item_id, item.quantity);
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
