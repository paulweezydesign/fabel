import { Suspense } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import {
  RecentDocumentsPanel,
  RecentDocumentsSkeleton,
} from "~/components/recent-documents-panel";
import { SignOutButton } from "~/components/sign-out-button";
import { requireUser } from "~/lib/session";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard — RR RSC Sandbox" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export function ServerComponent({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <main className="dashboard">
      <header className="dash-header">
        <div>
          <p className="brand">fabel / rr7-rsc-rag</p>
          <h1>Welcome, {user.name}</h1>
          <p className="lede">Signed in as {user.email}</p>
        </div>
        <div className="dash-actions">
          <Link to="/" viewTransition className="ghost-button">
            Home
          </Link>
          <SignOutButton />
        </div>
      </header>

      <section className="dash-section">
        <h2>Your documents</h2>
        <p className="section-note">
          Loaded in an async Server Component behind Suspense — watch the
          skeleton, then the list.
        </p>
        <Suspense fallback={<RecentDocumentsSkeleton />}>
          <RecentDocumentsPanel ownerId={user.id} />
        </Suspense>
      </section>

      <section className="dash-section muted">
        <h2>What&apos;s next</h2>
        <ol>
          <li>View transitions polish (Part 4)</li>
          <li>Document upload + Mastra ingest</li>
          <li>RAG chat island streaming against MongoDB Vector Search</li>
        </ol>
      </section>
    </main>
  );
}
