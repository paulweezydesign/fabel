export type AuthGateDecision =
  | { readonly action: 'allow' }
  | { readonly action: 'redirect'; readonly location: string }
  | { readonly action: 'unauthorized' };

const PUBLIC_EXACT = new Set(['/login', '/api/auth/login', '/api/auth/logout']);

export const isPublicPath = (pathname: string): boolean => {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return false;
};

export const resolveAuthGate = (options: {
  readonly authEnabled: boolean;
  readonly pathname: string;
  readonly hasValidSession: boolean;
  readonly isApi?: boolean;
}): AuthGateDecision => {
  if (!options.authEnabled) {
    return { action: 'allow' };
  }

  if (options.hasValidSession && options.pathname === '/login') {
    return { action: 'redirect', location: '/' };
  }

  if (isPublicPath(options.pathname)) {
    return { action: 'allow' };
  }

  if (options.hasValidSession) {
    return { action: 'allow' };
  }

  const isApi = options.isApi ?? options.pathname.startsWith('/api/');
  if (isApi) {
    return { action: 'unauthorized' };
  }

  const next = encodeURIComponent(options.pathname || '/');
  return { action: 'redirect', location: `/login?next=${next}` };
};
