import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT employee_id, name, role FROM employee ORDER BY employee_id`
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { name, role, pin } = await req.json();
  if (!name?.trim() || !role?.trim() || !pin?.toString().trim()) {
    return NextResponse.json({ error: 'Name, role, and PIN are required' }, { status: 400 });
  }
  try {
    const result = await pool.query(
      `INSERT INTO employee (name, role, pin) VALUES ($1, $2, $3) RETURNING employee_id, name, role`,
      [name.trim(), role.trim(), String(pin).trim()]
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
