import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, price, image_url, recipe } = await req.json();
  if (!name?.trim() || price === undefined) {
    return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE menu_item SET name = $1, price = $2, image_url = $3
       WHERE menu_item_id = $4 RETURNING *`,
      [name.trim(), Number(price), image_url?.trim() || null, id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (Array.isArray(recipe)) {
      await client.query(`DELETE FROM recipe WHERE menu_item_id = $1`, [id]);
      for (const row of recipe) {
        if (Number(row.qty_needed) > 0) {
          await client.query(
            `INSERT INTO recipe (menu_item_id, ingredient_id, qty_needed)
             VALUES ($1, $2, $3)`,
            [id, row.ingredient_id, Number(row.qty_needed)]
          );
        }
      }
    }

    await client.query('COMMIT');
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Remove toppings on order items for this menu item
    await client.query(
      `DELETE FROM order_item_toppings
       WHERE order_items_id IN (
         SELECT order_items_id FROM order_items WHERE menu_item_id = $1
       )`,
      [id]
    );
    // Remove order items referencing this menu item
    await client.query(`DELETE FROM order_items WHERE menu_item_id = $1`, [id]);
    // Remove recipe rows
    await client.query(`DELETE FROM recipe WHERE menu_item_id = $1`, [id]);
    // Finally delete the menu item itself
    const result = await client.query(
      `DELETE FROM menu_item WHERE menu_item_id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    await client.query('COMMIT');
    return NextResponse.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
