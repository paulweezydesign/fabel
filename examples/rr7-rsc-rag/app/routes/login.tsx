import { Link } from "react-router";
import type { Route } from "./+types/login";
import { AuthForm } from "~/components/auth-form";
import { getSessionUser } from "~/lib/session";
import { redirect } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign in — RR RSC Sandbox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (user) throw redirect("/dashboard");

  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") ?? "/dashboard";
  return { nextPath };
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  return (
    <main className="auth-page">
      <p className="brand">fabel / rr7-rsc-rag</p>
      <h1>Sign in</h1>
      <p className="lede">Password must be at least 10 characters.</p>
      <AuthForm mode="login" nextPath={loaderData.nextPath} />
      <p className="auth-switch">
        New here?{" "}
        <Link to="/signup" viewTransition>
          Create an account
        </Link>
      </p>
    </main>
  );
}
