// Vanilla, dependency-free client for the fabel Approval UI.
// All server interaction is plain fetch() against the JSON API.

const $ = (id) => document.getElementById(id);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const toast = (message) => {
  const node = $("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    node.hidden = true;
  }, 4000);
};

const api = async (path, options) => {
  const res = await fetch(path, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const message = data && data.error ? data.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
};

const prettyContent = (content) => {
  if (typeof content === "string") return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
};

// ---- Rendering ------------------------------------------------------------

const renderWorkflows = (workflows) => {
  const list = $("workflow-list");
  list.replaceChildren();
  if (!workflows.length) {
    list.append(el("li", "empty", "No workflows available."));
    return;
  }
  for (const wf of workflows) {
    const card = el("li", "workflow-card");
    card.append(el("div", "workflow-card__name", wf.name));
    card.append(
      el("div", "workflow-card__steps", `Steps: ${wf.steps.join(" → ")}`),
    );
    const startBtn = el("button", "btn-primary", "Start run");
    startBtn.addEventListener("click", () => startWorkflow(wf.slug, startBtn));
    card.append(startBtn);
    list.append(card);
  }
};

const renderRun = (run) => {
  $("run-placeholder").hidden = true;
  $("run-detail").hidden = false;

  const badge = $("run-status");
  badge.hidden = false;
  badge.className = `badge badge--${run.status}`;
  badge.textContent = run.status.replace(/_/g, " ");

  $("run-id").textContent = run.workflowId;

  const stepList = $("step-list");
  stepList.replaceChildren();

  for (const entry of run.steps) {
    const isGate =
      run.status === "needs_review" && entry.step.id === run.pausedStepId;
    const li = el("li", `step${isGate ? " step--gate" : ""}`);

    const info = el("div", "step__info");
    info.append(el("div", "step__title", entry.step.title));
    const meta = `${entry.step.agentType}${
      entry.step.requiresApproval ? " · approval gate" : ""
    }`;
    info.append(el("div", "step__meta", meta));
    if (entry.error) info.append(el("div", "step__error", entry.error));
    li.append(info);

    const right = el("div", "step__right");
    right.append(
      el(
        "span",
        `step-status step-status--${entry.status}`,
        entry.status.replace(/_/g, " "),
      ),
    );
    if (isGate) {
      const approveBtn = el("button", "btn-approve", "Approve");
      approveBtn.addEventListener("click", () =>
        approveGate(run.workflowId, run.pausedStepId, approveBtn),
      );
      right.append(approveBtn);
    }
    li.append(right);
    stepList.append(li);
  }
};

const renderArtifacts = (artifacts) => {
  const wrap = $("artifacts");
  const list = $("artifact-list");
  list.replaceChildren();
  if (!artifacts.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  for (const artifact of artifacts) {
    const card = el("div", "artifact");
    const head = el("div", "artifact__head");
    head.append(el("span", "artifact__title", artifact.title));
    head.append(el("span", "artifact__type", artifact.agentType));
    card.append(head);
    card.append(el("pre", "artifact__body", prettyContent(artifact.content)));
    list.append(card);
  }
};

// ---- Actions --------------------------------------------------------------

const refresh = async (workflowId) => {
  const [run, artifacts] = await Promise.all([
    api(`/api/workflows/${workflowId}`),
    api(`/api/artifacts/${workflowId}`),
  ]);
  renderRun(run);
  renderArtifacts(artifacts);
  return run;
};

const startWorkflow = async (slug, button) => {
  button.disabled = true;
  button.textContent = "Starting…";
  try {
    const run = await api(`/api/workflows/${slug}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        workflowInput: { prospect: "Acme Corp" },
        projectId: "ui-demo",
      }),
    });
    renderRun(run);
    renderArtifacts(await api(`/api/artifacts/${run.workflowId}`));
  } catch (err) {
    toast(`Failed to start: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Start run";
  }
};

const approveGate = async (workflowId, stepId, button) => {
  button.disabled = true;
  button.textContent = "Approving…";
  try {
    await api(`/api/workflows/${workflowId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    await refresh(workflowId);
  } catch (err) {
    toast(`Approval failed: ${err.message}`);
    button.disabled = false;
    button.textContent = "Approve";
  }
};

const loadWorkflows = async () => {
  try {
    renderWorkflows(await api("/api/workflows"));
  } catch (err) {
    $("workflow-list").replaceChildren(
      el("li", "empty", `Failed to load workflows: ${err.message}`),
    );
  }
};

loadWorkflows();
