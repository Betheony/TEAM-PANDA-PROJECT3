import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [items, toppings] = await Promise.all([
      pool.query('SELECT * FROM menu_item ORDER BY menu_item_id'),
      pool.query('SELECT * FROM topping ORDER BY topping_id'),
    ]);
    return NextResponse.json({ menuItems: items.rows, toppings: toppings.rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, price, image_url, recipe } = await req.json();
  if (!name?.trim() || price === undefined) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemResult = await client.query(
      `INSERT INTO menu_item (name, price, image_url)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), Number(price), image_url?.trim() || null]
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
