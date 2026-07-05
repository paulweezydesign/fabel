import { createServer, type IncomingMessage, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, sep } from "node:path";
import { createApp, type App } from "./app.js";
import { handleAgentRun, type HttpResult } from "./api/agent-run-handler.js";
import { workflows } from "./workflows/index.js";

/** A raw (non-JSON) HTTP response used to serve the static Approval UI. */
interface StaticResult {
  readonly status: number;
  readonly contentType: string;
  readonly body: string | Buffer;
}

const isStaticResult = (
  result: HttpResult | StaticResult,
): result is StaticResult => "contentType" in result;

/**
 * Root of the vanilla Approval UI. Resolved relative to this module so it works
 * both under `tsx` (from `src`) and when compiled to `dist`.
 */
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "web");

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const notFound: StaticResult = {
  status: 404,
  contentType: "application/json",
  body: JSON.stringify({ error: "Not found" }),
};

/**
 * Serves a file from {@link webRoot}. Path traversal is rejected: the requested
 * path is resolved against the web root and any result that escapes it -> 404.
 */
const serveStatic = async (pathname: string): Promise<StaticResult> => {
  let requested: string;
  try {
    requested = decodeURIComponent(pathname);
  } catch {
    return notFound;
  }
  const relative =
    requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const resolved = normalize(join(webRoot, relative));
  if (resolved !== webRoot && !resolved.startsWith(webRoot + sep)) {
    return notFound;
  }
  try {
    const body = await readFile(resolved);
    const contentType =
      CONTENT_TYPES[extname(resolved)] ?? "application/octet-stream";
    return { status: 200, contentType, body };
  } catch {
    return notFound;
  }
};

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim() === "") return {};
  return JSON.parse(raw) as unknown;
};

const route = async (
  req: IncomingMessage,
  app: App,
): Promise<HttpResult | StaticResult> => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const method = req.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    return { status: 200, body: { status: "ok" } };
  }

  if (method === "GET" && url.pathname === "/api/workflows") {
    return {
      status: 200,
      body: Object.entries(workflows).map(([slug, def]) => ({
        slug,
        name: def.name,
        steps: def.steps.map((s) => s.id),
      })),
    };
  }

  // POST /api/agents/:type/run
  if (
    method === "POST" &&
    parts[0] === "api" &&
    parts[1] === "agents" &&
    parts[3] === "run" &&
    parts.length === 4
  ) {
    return handleAgentRun(parts[2]!, await readJsonBody(req), {
      factory: app.factory,
    });
  }

  // POST /api/workflows/:slug/start
  if (
    method === "POST" &&
    parts[0] === "api" &&
    parts[1] === "workflows" &&
    parts[3] === "start" &&
    parts.length === 4
  ) {
    const def = workflows[parts[2]!];
    if (!def) {
      return { status: 404, body: { error: `Unknown workflow: ${parts[2]}` } };
    }
    const body = (await readJsonBody(req)) as {
      workflowInput?: unknown;
      projectId?: string;
    };
    const run = await app.runner.start(def, {
      workflowInput: body.workflowInput,
      ...(body.projectId ? { projectId: body.projectId } : {}),
    });
    return { status: 200, body: run };
  }

  // POST /api/workflows/:workflowId/approve  { stepId }
  if (
    method === "POST" &&
    parts[0] === "api" &&
    parts[1] === "workflows" &&
    parts[3] === "approve" &&
    parts.length === 4
  ) {
    const body = (await readJsonBody(req)) as { stepId?: string };
    if (!body.stepId) {
      return { status: 400, body: { error: "'stepId' is required" } };
    }
    try {
      const run = await app.runner.approve(parts[2]!, body.stepId);
      return { status: 200, body: run };
    } catch (error) {
      return {
        status: 409,
        body: { error: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  // GET /api/workflows/:workflowId
  if (
    method === "GET" &&
    parts[0] === "api" &&
    parts[1] === "workflows" &&
    parts.length === 3
  ) {
    const run = app.runner.getRun(parts[2]!);
    return run
      ? { status: 200, body: run }
      : { status: 404, body: { error: `Unknown workflow: ${parts[2]}` } };
  }

  // GET /api/artifacts/:workflowId
  if (
    method === "GET" &&
    parts[0] === "api" &&
    parts[1] === "artifacts" &&
    parts.length === 3
  ) {
    const artifacts = await app.services.artifactStore.getByWorkflowId(
      parts[2]!,
    );
    return { status: 200, body: artifacts };
  }

  // Static Approval UI: any GET/HEAD not under /api and not /health.
  if (
    (method === "GET" || method === "HEAD") &&
    parts[0] !== "api" &&
    url.pathname !== "/health"
  ) {
    return serveStatic(url.pathname);
  }

  return { status: 404, body: { error: "Not found" } };
};

/** Creates the standalone Node HTTP server (PRD §10 #4: standalone Node). */
export const createAgentServer = (app: App = createApp()): Server =>
  createServer((req, res) => {
    route(req, app)
      .then((result) => {
        if (isStaticResult(result)) {
          res.writeHead(result.status, { "content-type": result.contentType });
          // HEAD requests carry no body (curl -I, health checks).
          res.end(req.method === "HEAD" ? undefined : result.body);
          return;
        }
        res.writeHead(result.status, { "content-type": "application/json" });
        res.end(JSON.stringify(result.body));
      })
      .catch((error: unknown) => {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
  });

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  createAgentServer().listen(port, () => {
    console.log(`fabel agent server listening on http://localhost:${port}`);
  });
}
