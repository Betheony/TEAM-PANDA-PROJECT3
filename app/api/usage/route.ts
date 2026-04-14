import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from'); // e.g. "2024-01-01"
  const to   = searchParams.get('to');   // e.g. "2024-01-07"

  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
  }

  try {
    // Usage from recipes — subquery filters orders first so only in-period rows reach order_items
    const recipeUsage = await pool.query(`
      SELECT i.ingredient_id,
             i.name,
             i.qty_in_stock,
             i.target_qty,
             COALESCE(SUM(filtered.quantity * r.qty_needed), 0) AS qty_used
      FROM ingredient i
      LEFT JOIN recipe r ON r.ingredient_id = i.ingredient_id
      LEFT JOIN (
        SELECT oi.menu_item_id, oi.quantity
        FROM order_items oi
        JOIN "order" o ON o.order_id = oi.order_id
        WHERE o.created_at >= $1::date
          AND o.created_at <  $2::date + INTERVAL '1 day'
          AND o.order_status NOT IN ('cancelled', 'refunded')
      ) filtered ON filtered.menu_item_id = r.menu_item_id
      GROUP BY i.ingredient_id, i.name, i.qty_in_stock, i.target_qty
    `, [from, to]);

    // Usage from toppings
    const toppingUsage = await pool.query(`
      SELECT i.ingredient_id,
             COALESCE(SUM(filtered.topping_qty * filtered.quantity), 0) AS qty_used
      FROM ingredient i
      LEFT JOIN topping t ON t.ingredient_id = i.ingredient_id
      LEFT JOIN (
        SELECT oit.topping_id, oit.topping_qty, oi.quantity
        FROM order_item_toppings oit
        JOIN order_items oi ON oi.order_items_id = oit.order_items_id
        JOIN "order" o ON o.order_id = oi.order_id
        WHERE o.created_at >= $1::date
          AND o.created_at <  $2::date + INTERVAL '1 day'
          AND o.order_status NOT IN ('cancelled', 'refunded')
      ) filtered ON filtered.topping_id = t.topping_id
      GROUP BY i.ingredient_id
    `, [from, to]);

    // Merge both sources
    const toppingMap = new Map<number, number>(
      toppingUsage.rows.map(r => [r.ingredient_id, Number(r.qty_used)])
    );

    const merged = recipeUsage.rows.map(r => ({
      ingredient_id: r.ingredient_id,
      name:          r.name,
      qty_in_stock:  Number(r.qty_in_stock),
      target_qty:    Number(r.target_qty),
      qty_used:      Number(r.qty_used) + (toppingMap.get(r.ingredient_id) ?? 0),
    }));

    // Sort by usage descending, omit zero-usage ingredients
    const result = merged
      .filter(r => r.qty_used > 0)
      .sort((a, b) => b.qty_used - a.qty_used);

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
