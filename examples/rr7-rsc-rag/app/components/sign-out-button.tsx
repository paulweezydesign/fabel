"use client";

import { useTransition } from "react";
import { useNavigate } from "react-router";
import { authClient } from "~/lib/auth-client";

export function SignOutButton() {
  const navigate = useNavigate();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="ghost-button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await authClient.signOut();
          navigate("/", { viewTransition: true });
        });
      }}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
