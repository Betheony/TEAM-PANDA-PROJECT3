import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { order_status } = await req.json();
    const result = await pool.query(
      `UPDATE "order" SET order_status = $1 WHERE order_id = $2 RETURNING *`,
      [order_status, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
