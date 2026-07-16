import { Link, redirect } from "react-router";
import type { Route } from "./+types/signup";
import { AuthForm } from "~/components/auth-form";
import { getSessionUser } from "~/lib/session";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up — RR RSC Sandbox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getSessionUser(request);
  if (user) throw redirect("/dashboard");
  return null;
}

export function ServerComponent() {
  return (
    <main className="auth-page">
      <p className="brand">fabel / rr7-rsc-rag</p>
      <h1>Create account</h1>
      <p className="lede">
        Better Auth + MongoDB (in-memory by default for local demos).
      </p>
      <AuthForm mode="signup" nextPath="/dashboard" />
      <p className="auth-switch">
        Already have an account?{" "}
        <Link to="/login" viewTransition>
          Sign in
        </Link>
      </p>
    </main>
  );
}
