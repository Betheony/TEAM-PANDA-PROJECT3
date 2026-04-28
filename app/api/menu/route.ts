import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const MENU_CATEGORIES = new Set(['hot', 'cold', 'special']);

async function getMenuItemColumns() {
  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'menu_item'`
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function normalizeCategory(category: unknown) {
  return typeof category === 'string' && MENU_CATEGORIES.has(category)
    ? category
    : 'cold';
}

export async function GET() {
  try {
    const [items, toppings] = await Promise.all([
      pool.query(`
        SELECT
          mi.*,
          COALESCE(
            json_agg(
              json_build_object(
                'ingredient_id', r.ingredient_id,
                'ingredient_name', i.name,
                'qty_needed', r.qty_needed
              )
              ORDER BY i.name
            ) FILTER (WHERE r.ingredient_id IS NOT NULL),
            '[]'::json
          ) AS recipe
        FROM menu_item mi
        LEFT JOIN recipe r ON r.menu_item_id = mi.menu_item_id
        LEFT JOIN ingredient i ON i.ingredient_id = r.ingredient_id
        GROUP BY mi.menu_item_id
        ORDER BY mi.menu_item_id
      `),
      pool.query('SELECT * FROM topping ORDER BY topping_id'),
    ]);
    return NextResponse.json({ menuItems: items.rows, toppings: toppings.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, price, image_url, category, recipe } = await req.json();
  if (!name?.trim() || price === undefined) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const menuItemColumns = await getMenuItemColumns();
    const columns = ['name', 'price', 'image_url'];
    const values: Array<string | number | null> = [
      name.trim(),
      Number(price),
      image_url?.trim() || null,
    ];

    if (menuItemColumns.has('category')) {
      columns.push('category');
      values.push(normalizeCategory(category));
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const itemResult = await client.query(
      `INSERT INTO menu_item (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      values
    );
    const newItem = itemResult.rows[0];
    // recipe is an array of { ingredient_id, qty_needed }
    for (const row of (recipe || [])) {
      if (row.qty_needed > 0) {
        await client.query(
          `INSERT INTO recipe (menu_item_id, ingredient_id, qty_needed)
           VALUES ($1, $2, $3)`,
          [newItem.menu_item_id, row.ingredient_id, row.qty_needed]
        );
      }
    }
    await client.query('COMMIT');
    return NextResponse.json(newItem, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
