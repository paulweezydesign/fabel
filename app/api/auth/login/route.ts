import { createLoginHandler } from '@/server/auth-handlers';

const login = createLoginHandler();

export async function POST(request: Request): Promise<Response> {
  return login(request);
}
