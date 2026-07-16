import { listRecentDocuments, ensureDemoDocuments } from "~/lib/documents";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RecentDocumentsPanelProps = {
  ownerId: string;
};

/** Async Server Component — wrap in <Suspense> from the parent route. */
export async function RecentDocumentsPanel({
  ownerId,
}: RecentDocumentsPanelProps) {
  // Artificial pause so Suspense fallback is visible during demos/teaching.
  await delay(400);
  await ensureDemoDocuments(ownerId);
  const docs = await listRecentDocuments(ownerId);

  if (docs.length === 0) {
    return (
      <div className="panel empty">
        <p>No documents yet. Upload flow lands in Part 6 of the series.</p>
      </div>
    );
  }

  return (
    <ul className="doc-list">
      {docs.map((doc) => (
        <li key={doc.id}>
          <h3>{doc.title}</h3>
          <p>{doc.summary}</p>
          <time dateTime={doc.updatedAt}>
            {new Date(doc.updatedAt).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}

export function RecentDocumentsSkeleton() {
  return (
    <div className="panel skeleton" aria-busy="true" aria-label="Loading documents">
      <div className="skel-line" />
      <div className="skel-line short" />
      <div className="skel-line" />
      <div className="skel-line short" />
    </div>
  );
}
