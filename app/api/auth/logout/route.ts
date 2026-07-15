import { createLogoutHandler } from '@/server/auth-handlers';

const logout = createLogoutHandler();

export async function POST(request: Request): Promise<Response> {
  return logout(request);
}
