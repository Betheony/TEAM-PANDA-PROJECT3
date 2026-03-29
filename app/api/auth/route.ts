import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { name, pin } = await req.json();
    const result = await pool.query(
      `SELECT employee_id, name, role
       FROM employee
       WHERE LOWER(name) = LOWER($1) AND pin::text = $2`,
      [name, String(pin)]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid name or PIN' }, { status: 401 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
