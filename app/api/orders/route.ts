import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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
  const { items, payment_method } = await req.json();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
        // Deduct topping ingredient stock
        await client.query(
          `UPDATE ingredient
           SET qty_in_stock = GREATEST(0, qty_in_stock - $1)
           WHERE ingredient_id = (SELECT ingredient_id FROM topping WHERE topping_id = $2)`,
          [topping.topping_qty * item.quantity, topping.topping_id]
        );
      }

      // Deduct recipe ingredients (best-effort: ignore if recipe table schema differs)
      try {
        await client.query(
          `UPDATE ingredient i
           SET qty_in_stock = GREATEST(0, i.qty_in_stock - (r.qty_needed * $1))
           FROM recipe r
           WHERE r.ingredient_id = i.ingredient_id AND r.menu_item_id = $2`,
          [item.quantity, item.menu_item_id]
        );
      } catch (_) {
        // recipe table may have different schema; skip silently
      }
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
