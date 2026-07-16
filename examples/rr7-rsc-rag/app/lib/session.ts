import { redirect } from "react-router";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionResult = {
  user: SessionUser;
} | null;

export type SessionDeps = {
  getSession: (request: Request) => Promise<SessionResult>;
};

const defaultGetSession = async (request: Request): Promise<SessionResult> => {
  const { auth } = await import("./auth.server");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  };
};

export async function getSessionUser(
  request: Request,
  deps: SessionDeps = { getSession: defaultGetSession },
): Promise<SessionUser | null> {
  const session = await deps.getSession(request);
  return session?.user ?? null;
}

export type RequireUserOptions = {
  loginPath?: string;
};

export async function requireUser(
  request: Request,
  deps: SessionDeps = { getSession: defaultGetSession },
  options: RequireUserOptions = {},
): Promise<SessionUser> {
  const user = await getSessionUser(request, deps);
  if (user) return user;

  const loginPath = options.loginPath ?? "/login";
  const url = new URL(request.url);
  const next = `${url.pathname}${url.search}`;
  const target = new URL(loginPath, url.origin);
  if (next && next !== "/login") {
    target.searchParams.set("next", next);
  }
  throw redirect(`${target.pathname}${target.search}`);
}
