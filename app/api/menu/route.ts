import { NextResponse } from 'next/server';
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
