import { NextRequest, NextResponse } from 'next/server';
import { authenticated, adminConfigured } from './lib/server/auth';
export function proxy(request: NextRequest) {
  if (!adminConfigured())
    return new NextResponse(
      'Administrasjonen er deaktivert. Sett et sikkert ADMIN_PASSWORD på minst 20 tegn på serveren.',
      {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      },
    );
  if (!authenticated(request.headers.get('authorization')))
    return new NextResponse('Logg inn for å åpne administrasjonen.', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Dyrpris administrasjon", charset="UTF-8"',
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
