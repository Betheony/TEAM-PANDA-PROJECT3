import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const [summary, byStatus, byPayment, hourly, topItems] = await Promise.all([
      // Overall day summary
      pool.query(`
        SELECT
          COUNT(*)::int                                                           AS total_orders,
          COUNT(*) FILTER (WHERE order_status = 'completed')::int                AS completed_orders,
          COALESCE(SUM(item_total) FILTER (WHERE order_status = 'completed'), 0) AS total_revenue,
          COALESCE(AVG(item_total) FILTER (WHERE order_status = 'completed'), 0) AS avg_order_value
        FROM (
          SELECT o.order_id, o.order_status,
                 COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS item_total
          FROM "order" o
          LEFT JOIN order_items oi ON oi.order_id = o.order_id
          WHERE o.created_at >= CURRENT_DATE
            AND o.created_at <  CURRENT_DATE + INTERVAL '1 day'
          GROUP BY o.order_id, o.order_status
        ) sub
      `),

      // Count by status
      pool.query(`
        SELECT order_status AS status, COUNT(*)::int AS count
        FROM "order"
        WHERE created_at >= CURRENT_DATE
          AND created_at <  CURRENT_DATE + INTERVAL '1 day'
        GROUP BY order_status
        ORDER BY count DESC
      `),

      // Revenue & count by payment method (completed only)
      pool.query(`
        SELECT o.payment_method,
               COUNT(*)::int                               AS count,
               COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM "order" o
        LEFT JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.created_at >= CURRENT_DATE
          AND o.created_at <  CURRENT_DATE + INTERVAL '1 day'
          AND o.order_status = 'completed'
        GROUP BY o.payment_method
        ORDER BY revenue DESC
      `),

      // Hourly breakdown (completed orders, 0–23)
      pool.query(`
        SELECT EXTRACT(HOUR FROM o.created_at)::int         AS hour,
               COUNT(DISTINCT o.order_id)::int              AS order_count,
               COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
        FROM "order" o
        LEFT JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.created_at >= CURRENT_DATE
          AND o.created_at <  CURRENT_DATE + INTERVAL '1 day'
          AND o.order_status = 'completed'
        GROUP BY hour
        ORDER BY hour
      `),

      // Top 8 selling items by quantity (all orders today, any status)
      pool.query(`
        SELECT mi.name,
               SUM(oi.quantity)::int                         AS qty,
               SUM(oi.quantity * oi.unit_price)              AS revenue
        FROM order_items oi
        JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
        JOIN "order" o    ON o.order_id = oi.order_id
        WHERE o.created_at >= CURRENT_DATE
          AND o.created_at <  CURRENT_DATE + INTERVAL '1 day'
        GROUP BY mi.name
        ORDER BY qty DESC
        LIMIT 8
      `),
    ]);

    return NextResponse.json({
      summary: summary.rows[0],
      byStatus: byStatus.rows,
      byPayment: byPayment.rows,
      hourly: hourly.rows,
      topItems: topItems.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
