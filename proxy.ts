import { NextResponse, type NextRequest } from 'next/server';
import { resolveAuthConfig } from '@/auth/auth-config';
import { readCookieValue, SESSION_COOKIE_NAME } from '@/auth/cookies';
import { resolveAuthGate } from '@/auth/protect';
import { verifySessionToken } from '@/auth/session';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const config = resolveAuthConfig();
  const pathname = request.nextUrl.pathname;
  const token = readCookieValue(
    request.headers.get('cookie'),
    SESSION_COOKIE_NAME,
  );

  let hasValidSession = false;
  if (config.enabled && token) {
    const verified = await verifySessionToken(token, { secret: config.secret });
    hasValidSession = verified.ok;
  }

  const decision = resolveAuthGate({
    authEnabled: config.enabled,
    pathname,
    hasValidSession,
    isApi: pathname.startsWith('/api/'),
  });

  if (decision.action === 'allow') {
    return NextResponse.next();
  }

  if (decision.action === 'unauthorized') {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  const location = decision.location;
  if (location.startsWith('/')) {
    const [path, query] = location.split('?');
    url.pathname = path;
    url.search = query ? `?${query}` : '';
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(location, request.url));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
