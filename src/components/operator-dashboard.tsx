'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Artifact } from '@/core/artifact-store';
import type { ApprovalEdits } from '@/client/approval-edits';
import { formatApprovalToast, formatRejectionToast } from '@/client/approval-ui';
import {
  buildStepTimeline,
  canApproveRun,
  canRejectRun,
  shouldPollRun,
  statusLabel,
} from '@/client/dashboard-state';
import { formatArtifactForDisplay } from '@/client/artifact-renderer';
import { ApprovalGatePanel } from '@/components/approval-gate-panel';
import { Toast, useToast } from '@/components/toast';
import {
  createWorkflowClient,
  WorkflowClientError,
  type WorkflowRunDetail,
  type WorkflowRunSummary,
} from '@/client/workflow-client';
import {
  listWorkflowDefinitionMeta,
  resolveWorkflowDefinition,
  type WorkflowId,
} from '@/workflows/catalog';

const workflows = listWorkflowDefinitionMeta();
const client = createWorkflowClient();
const POLL_INTERVAL_MS = 2000;

type Phase = 'idle' | 'starting' | 'approving' | 'saving' | 'rejecting' | 'ready';

export function OperatorDashboard() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowId>('lead-to-outreach');
  const [projectId, setProjectId] = useState('proj-1');
  const [clientName, setClientName] = useState('');
  const [goal, setGoal] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null);
  const [pastRuns, setPastRuns] = useState<readonly WorkflowRunSummary[]>([]);
  const [loadingPastRuns, setLoadingPastRuns] = useState(true);
  const { toast, showToast } = useToast();

  const run = detail?.run ?? null;
  const artifacts = detail?.artifacts ?? [];

  const definition = useMemo(
    () => (run ? resolveWorkflowDefinition(run.definitionId as WorkflowId, run.projectId) : null),
    [run],
  );

  const timeline = useMemo(
    () => (definition && run ? buildStepTimeline(definition, run) : []),
    [definition, run],
  );

  const loadDetail = useCallback(async (runId: string) => {
    const next = await client.getRun(runId);
    setDetail(next);
    return next;
  }, []);

  const refreshPastRuns = useCallback(async () => {
    try {
      const runs = await client.listRuns();
      setPastRuns(runs);
    } catch {
      /* list failures are non-blocking; operator can still start a new run */
    } finally {
      setLoadingPastRuns(false);
    }
  }, []);

  useEffect(() => {
    void refreshPastRuns();
  }, [refreshPastRuns]);

  const handleSelectPastRun = async (runId: string) => {
    setError(null);
    setPhase('ready');

    try {
      await loadDetail(runId);
    } catch (err) {
      setDetail(null);
      setPhase('idle');
      setError(err instanceof WorkflowClientError ? err.message : 'Failed to load workflow run.');
    }
  };

  useEffect(() => {
    if (!run || !shouldPollRun(run)) return;

    const interval = window.setInterval(() => {
      void loadDetail(run.id).catch(() => {
        /* polling errors surface on the next explicit action */
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [run, loadDetail]);

  const handleStart = async () => {
    setError(null);
    setPhase('starting');

    try {
      const started = await client.start(selectedWorkflow, {
        projectId,
        input: {
          leadName: clientName,
          clientName,
          client: clientName,
          goal,
        },
      });
      setDetail({ run: started, artifacts: [] });
      setPhase('ready');
      void loadDetail(started.id);
      void refreshPastRuns();
    } catch (err) {
      setPhase('idle');
      setDetail(null);
      const message =
        err instanceof WorkflowClientError ? err.message : 'Failed to start workflow.';
      setError(message);
      showToast(`Failed to start: ${message}`, 'error');
    }
  };

  const handleApprove = async (edits?: ApprovalEdits) => {
    if (!run?.pendingApprovalStepId) return;

    setError(null);
    setPhase('approving');

    try {
      const approved = await client.approve(run.id, run.pendingApprovalStepId, edits);
      setDetail((current) =>
        current ? { ...current, run: approved } : { run: approved, artifacts: [] },
      );
      setPhase('ready');
      showToast(formatApprovalToast(approved), 'success');
      void loadDetail(approved.id);
      void refreshPastRuns();
    } catch (err) {
      setPhase('ready');
      const message =
        err instanceof WorkflowClientError ? err.message : 'Failed to approve workflow.';
      setError(message);
      showToast(`Approval failed: ${message}`, 'error');
    }
  };

  const handleSaveEdits = async (edits: ApprovalEdits) => {
    if (!run?.pendingApprovalStepId) return;

    setError(null);
    setPhase('saving');

    try {
      const updated = await client.editPendingArtifact(
        run.id,
        run.pendingApprovalStepId,
        edits,
      );
      setDetail(updated);
      setPhase('ready');
      showToast('Edits saved — still awaiting approval', 'success');
    } catch (err) {
      setPhase('ready');
      const message =
        err instanceof WorkflowClientError ? err.message : 'Failed to save edits.';
      setError(message);
      showToast(`Save failed: ${message}`, 'error');
    }
  };

  const handleReject = async (reason: string) => {
    if (!run?.pendingApprovalStepId) return;

    setError(null);
    setPhase('rejecting');

    try {
      const rejected = await client.reject(run.id, run.pendingApprovalStepId, reason);
      setDetail((current) =>
        current ? { ...current, run: rejected } : { run: rejected, artifacts: [] },
      );
      setPhase('ready');
      showToast(formatRejectionToast(rejected), 'error');
      void loadDetail(rejected.id);
      void refreshPastRuns();
    } catch (err) {
      setPhase('ready');
      const message =
        err instanceof WorkflowClientError ? err.message : 'Failed to reject workflow.';
      setError(message);
      showToast(`Rejection failed: ${message}`, 'error');
    }
  };

  const handleReset = () => {
    setDetail(null);
    setError(null);
    setPhase('idle');
    void refreshPastRuns();
  };

  const busy =
    phase === 'starting' ||
    phase === 'approving' ||
    phase === 'saving' ||
    phase === 'rejecting';
  const polling = run !== null && shouldPollRun(run);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Fabel</h1>
        <p>Run multi-agent workflows, review output, and approve before anything ships.</p>
      </header>

      {!run && (
        <>
          <section className="panel">
            <h2>Past runs</h2>
            {loadingPastRuns ? (
              <p className="empty-state">Loading run history…</p>
            ) : pastRuns.length === 0 ? (
              <p className="empty-state">No past runs yet — start a workflow below.</p>
            ) : (
              <ul className="run-history-list">
                {pastRuns.map((pastRun) => (
                  <li key={pastRun.id}>
                    <button
                      type="button"
                      className="run-history-item"
                      onClick={() => handleSelectPastRun(pastRun.id)}
                      disabled={busy}
                    >
                      <span className="run-history-main">
                        <strong>{pastRun.definitionId}</strong>
                        <span className={`status-badge ${pastRun.status}`}>
                          {statusLabel(pastRun.status)}
                        </span>
                      </span>
                      <span className="run-history-meta">
                        <span>
                          Project <code>{pastRun.projectId}</code>
                        </span>
                        <span>
                          Run <code>{pastRun.id.slice(0, 8)}…</code>
                        </span>
                        {pastRun.updatedAt && (
                          <span>{new Date(pastRun.updatedAt).toLocaleString()}</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>Choose a workflow</h2>
            <div className="workflow-grid">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  className={`workflow-card${selectedWorkflow === workflow.id ? ' selected' : ''}`}
                  onClick={() => setSelectedWorkflow(workflow.id)}
                  disabled={busy}
                >
                  <strong>{workflow.name}</strong>
                  <span>{workflow.id}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Client details</h2>
            <div className="form-grid">
              <label>
                Project ID
                <input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="proj-1"
                  disabled={busy}
                />
              </label>
              <label>
                Client / lead name
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Acme Corp"
                  disabled={busy}
                />
              </label>
              <label>
                Goal (optional)
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="New e-commerce site, Q3 launch…"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleStart}
                disabled={busy || !projectId.trim() || !clientName.trim()}
              >
                {phase === 'starting' && <span className="spinner" />}
                Run workflow
              </button>
            </div>
          </section>
        </>
      )}

      {run && definition && (
        <>
          <section className="panel">
            <h2>{definition.name}</h2>
            <div className="run-meta">
              <span>
                Run <code>{run.id.slice(0, 8)}…</code>
              </span>
              <span className={`status-badge ${run.status}`}>{statusLabel(run.status)}</span>
              {polling && <span>Updating live…</span>}
              {run.error && <span>{run.error}</span>}
            </div>

            <ol className="step-list">
              {timeline.map((step) => (
                <li
                  key={step.id}
                  className={`step-item${step.awaitingApproval ? ' step-item--gate' : ''}`}
                >
                  <span className={`step-dot ${step.status}`} aria-hidden />
                  <div className="step-body">
                    <strong>{step.title}</strong>
                    <small>
                      {step.agentType.replace(/_/g, ' ')} · {step.status.replace(/_/g, ' ')}
                      {step.requiresApproval ? ' · approval gate' : ''}
                    </small>
                    {step.awaitingApproval && (
                      <span className="approval-tag">Awaiting your approval</span>
                    )}
                  </div>
                  {step.awaitingApproval && (
                    <button
                      type="button"
                      className="btn-approve btn-approve--inline"
                      onClick={() => handleApprove()}
                      disabled={busy}
                    >
                      {phase === 'approving' && <span className="spinner" />}
                      Approve
                    </button>
                  )}
                </li>
              ))}
            </ol>

            <div className="actions">
              {canRejectRun(run) && (
                <button
                  type="button"
                  className="btn-reject"
                  onClick={() => handleReject('')}
                  disabled={busy}
                >
                  {phase === 'rejecting' && <span className="spinner" />}
                  Reject
                </button>
              )}
              {canApproveRun(run) && (
                <button
                  type="button"
                  className="btn-success"
                  onClick={() => handleApprove()}
                  disabled={busy}
                >
                  {phase === 'approving' && <span className="spinner" />}
                  Approve &amp; continue
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                disabled={busy}
              >
                Start new run
              </button>
            </div>
          </section>

          <ApprovalGatePanel
            run={run}
            definition={definition}
            artifacts={artifacts}
            onApprove={handleApprove}
            onSaveEdits={handleSaveEdits}
            onReject={handleReject}
            approving={phase === 'approving'}
            saving={phase === 'saving'}
            rejecting={phase === 'rejecting'}
            busy={busy}
          />

          <section className="panel">
            <h2>Artifacts</h2>
            {artifacts.length === 0 ? (
              <p className="empty-state">
                {polling ? 'Agents are working — artifacts will appear here.' : 'No artifacts yet.'}
              </p>
            ) : (
              <div className="artifact-list">
                {artifacts.map((artifact: Artifact) => {
                  const display = formatArtifactForDisplay(artifact.content);
                  return (
                    <article key={artifact.id} className="artifact-card">
                      <header>
                        <strong>{artifact.title}</strong>
                        <span>{artifact.agentType.replace(/_/g, ' ')}</span>
                      </header>
                      <div className="artifact-body">
                        <p className="artifact-summary">{display.summary}</p>
                        {display.highlights.length > 0 && (
                          <dl className="artifact-highlights">
                            {display.highlights.map((highlight) => (
                              <div key={highlight.label} className="artifact-highlight">
                                <dt>{highlight.label}</dt>
                                <dd>
                                  {Array.isArray(highlight.value) ? (
                                    <ul>
                                      {highlight.value.map((item) => (
                                        <li key={item}>{item}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p>{highlight.value}</p>
                                  )}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        <details className="artifact-raw">
                          <summary>Raw JSON</summary>
                          <pre>{display.raw}</pre>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {error && <div className="error-banner">{error}</div>}
      <Toast toast={toast} />
    </div>
  );
}
