import { Link } from "react-router";
import type { Route } from "./+types/home";
import { getSessionUser } from "~/lib/session";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "RR RSC Sandbox — Part 1" },
    {
      name: "description",
      content:
        "React Router RSC Framework Mode sandbox with Better Auth, MongoDB, and Suspense.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  return { user };
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <main className="hero">
      <p className="brand">fabel / rr7-rsc-rag</p>
      <h1>Chat with your data starts here.</h1>
      <p className="lede">
        Part 1 sandbox: React Router RSC, nested Suspense, Better Auth, and
        MongoDB — before the Mastra RAG agent lands.
      </p>
      <div className="cta-row">
        {user ? (
          <Link to="/dashboard" viewTransition className="button">
            Open dashboard
          </Link>
        ) : (
          <>
            <Link to="/signup" viewTransition className="button">
              Create account
            </Link>
            <Link to="/login" viewTransition className="button ghost">
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
