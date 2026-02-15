import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePipelines } from '../hooks/useCircleCI';
import { useAuth } from '../context/AuthContext';
import { StatusBadge, isActiveStatus } from '../components/StatusBadge';
import { ErrorDisplay, EmptyState, Skeleton } from '../components/Layout';
import {
  formatRelativeTime,
  formatDurationBetween,
  shortSha,
  truncate,
} from '../utils/format';
import type { Pipeline, Workflow, WorkflowStatus } from '../types/circleci';

export function Pipelines() {
  const { branch } = useParams<{ branch: string }>();
  const decodedBranch = branch ? decodeURIComponent(branch) : '';
  const { data: pipelines, loading, error, refetch } = usePipelines(decodedBranch);

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/branches"
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path
                fillRule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-slate-100">
              {decodedBranch}
            </h2>
            <p className="text-sm text-slate-500">Pipeline history</p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && !pipelines ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-5">
              <Skeleton className="h-5 w-64 mb-3" />
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : pipelines && pipelines.length === 0 ? (
        <EmptyState message={`No pipelines found for branch "${decodedBranch}"`} />
      ) : (
        <div className="space-y-4">
          {pipelines?.map((pipeline) => (
            <PipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Card showing a pipeline with its workflows */
function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const { client } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWf, setLoadingWf] = useState(true);

  const fetchWorkflows = useCallback(async () => {
    if (!client) return;
    try {
      const { items } = await client.getWorkflows(pipeline.id);
      setWorkflows(items);
    } catch {
      // silently fail
    } finally {
      setLoadingWf(false);
    }
  }, [client, pipeline.id]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Auto-refresh if any workflow is active
  useEffect(() => {
    const hasActive = workflows.some((w) => isActiveStatus(w.status));
    if (!hasActive) return;

    const interval = setInterval(fetchWorkflows, 10_000);
    return () => clearInterval(interval);
  }, [workflows, fetchWorkflows]);

  const aggregateStatus: WorkflowStatus | undefined = workflows.length > 0
    ? aggregateWorkflowStatuses(workflows)
    : undefined;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Pipeline header */}
      <div className="p-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-100">
              #{pipeline.number}
            </span>
            {aggregateStatus && <StatusBadge status={aggregateStatus} />}
            <span className="text-xs text-slate-600">
              {formatRelativeTime(pipeline.created_at)}
            </span>
          </div>

          {pipeline.vcs.commit?.subject && (
            <p className="mt-1 text-sm text-slate-400 truncate">
              {truncate(pipeline.vcs.commit.subject, 80)}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
            <code>{shortSha(pipeline.vcs.revision)}</code>
            {pipeline.trigger.actor.login && (
              <span>by {pipeline.trigger.actor.login}</span>
            )}
            <span>{pipeline.trigger.type}</span>
          </div>
        </div>
      </div>

      {/* Workflows */}
      {loadingWf ? (
        <div className="border-t border-slate-800 p-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : workflows.length > 0 ? (
        <div className="border-t border-slate-800">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              to={`/pipeline/${pipeline.id}/workflow/${wf.id}`}
              className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-b-0"
            >
              <StatusBadge status={wf.status} />
              <span className="text-sm text-slate-200 font-medium">
                {wf.name}
              </span>
              <div className="flex-1" />
              {wf.stopped_at && (
                <span className="text-xs text-slate-500">
                  {formatDurationBetween(wf.created_at, wf.stopped_at)}
                </span>
              )}
              {isActiveStatus(wf.status) && (
                <span className="text-xs text-sky-400">
                  {formatDurationBetween(wf.created_at)}
                </span>
              )}
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-slate-600 shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function aggregateWorkflowStatuses(workflows: Workflow[]): WorkflowStatus {
  const priority: WorkflowStatus[] = [
    'failed', 'error', 'failing', 'running', 'on_hold',
    'canceled', 'not_run', 'unauthorized', 'success',
  ];
  for (const status of priority) {
    if (workflows.some((w) => w.status === status)) return status;
  }
  return workflows[0].status;
}
