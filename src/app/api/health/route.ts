import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await getPool().query('SELECT id FROM offers LIMIT 1');
    return NextResponse.json({ status: 'ok', database: 'ready' });
  } catch {
    return NextResponse.json({ status: 'unavailable', database: 'unavailable' }, { status: 503 });
  }
}
