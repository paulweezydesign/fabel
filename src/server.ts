import { createServer, type IncomingMessage, type Server } from "node:http";
import { createApp, type App } from "./app.js";
import { handleAgentRun, type HttpResult } from "./api/agent-run-handler.js";
import { workflows } from "./workflows/index.js";

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
): Promise<HttpResult> => {
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

  return { status: 404, body: { error: "Not found" } };
};

/** Creates the standalone Node HTTP server (PRD §10 #4: standalone Node). */
export const createAgentServer = (app: App = createApp()): Server =>
  createServer((req, res) => {
    route(req, app)
      .then(({ status, body }) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(body));
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
