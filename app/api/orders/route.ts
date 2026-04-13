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
