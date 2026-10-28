import { NextRequest, NextResponse } from 'next/server';
import { authenticated, validOrigin } from '@/lib/server/auth';
import { reviewProposal } from '@/lib/server/review';
export async function POST(request: NextRequest) {
  if (!authenticated(request.headers.get('authorization')))
    return new NextResponse('Ingen tilgang', { status: 401 });
  if (!validOrigin(request.headers.get('origin'), process.env.APP_ORIGIN || request.nextUrl.origin))
    return new NextResponse('Ugyldig opprinnelse', { status: 403 });
  if (
    Number(request.headers.get('content-length') || 0) > 8192 ||
    !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')
  )
    return new NextResponse('Ugyldig forespørsel', { status: 400 });
  let body: string;
  try {
    body = await request.text();
  } catch {
    return new NextResponse('Avbrutt forespørsel', { status: 400 });
  }
  if (body.length > 8192) return new NextResponse('For stor forespørsel', { status: 413 });
  const data = new URLSearchParams(body),
    id = data.get('id'),
    action = data.get('action'),
    note = data.get('note') || '';
  if (
    !id ||
    !/^[a-zA-Z0-9-]{1,100}$/.test(id) ||
    !['approve', 'reject'].includes(action || '') ||
    note.length > 1000
  )
    return new NextResponse('Ugyldige felter', { status: 400 });
  let result = 'ok';
  try {
    await reviewProposal(
      id,
      action as 'approve' | 'reject',
      process.env.ADMIN_USER || 'admin',
      note,
    );
  } catch (e) {
    result =
      e instanceof Error && /allerede|annen pris|finnes ikke/.test(e.message)
        ? 'conflict'
        : 'error';
    console.error('review_failed', result);
  }
  // A relative Location preserves the browser origin behind a reverse proxy.
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/admin?result=${result}`, 'Cache-Control': 'no-store' },
  });
}
