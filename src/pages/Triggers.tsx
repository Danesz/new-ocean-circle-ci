import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTriggeredPipelines, type TriggeredPipeline } from '../hooks/useCircleCI';
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

type GroupKey = 'all' | 'api' | 'schedule' | 'tag' | 'other';

const GROUP_LABELS: Record<GroupKey, string> = {
  all: 'All',
  api: 'API',
  schedule: 'Scheduled',
  tag: 'Tags',
  other: 'Other',
};

export function Triggers() {
  const { data: triggered, loading, error, refetch } = useTriggeredPipelines();
  const [filter, setFilter] = useState<GroupKey>('all');

  // Count per group for filter tabs
  const groupCounts = useMemo(() => {
    if (!triggered) return {} as Record<GroupKey, number>;
    const counts: Record<GroupKey, number> = { all: triggered.length, api: 0, schedule: 0, tag: 0, other: 0 };
    for (const t of triggered) {
      const group = classifyTrigger(t);
      counts[group]++;
    }
    return counts;
  }, [triggered]);

  const filtered = useMemo(() => {
    if (!triggered) return [];
    if (filter === 'all') return triggered;
    return triggered.filter((t) => classifyTrigger(t) === filter);
  }, [triggered, filter]);

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
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
              Triggered Pipelines
            </h2>
            <p className="text-sm text-slate-500">
              Pipelines from API calls, schedules, tags, and other non-branch triggers
            </p>
          </div>
        </div>
        <button
          onClick={refetch}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      {triggered && triggered.length > 0 && (
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-lg p-1 w-fit">
          {(Object.keys(GROUP_LABELS) as GroupKey[]).map((key) => {
            const count = groupCounts[key] ?? 0;
            if (key !== 'all' && count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  filter === key
                    ? 'bg-slate-700 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {GROUP_LABELS[key]}
                <span className="ml-1.5 text-xs text-slate-500">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pipeline list */}
      {loading && !triggered ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-5">
              <Skeleton className="h-5 w-64 mb-3" />
              <Skeleton className="h-4 w-40 mb-4" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={
            filter === 'all'
              ? 'No triggered pipelines found'
              : `No ${GROUP_LABELS[filter].toLowerCase()} pipelines found`
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((t) => (
            <TriggeredPipelineCard key={t.pipeline.id} triggered={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Card showing a single triggered pipeline with its workflows */
function TriggeredPipelineCard({ triggered }: { triggered: TriggeredPipeline }) {
  const { client } = useAuth();
  const { pipeline, triggerLabel } = triggered;
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
      <div className="p-4 flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-100">
              #{pipeline.number}
            </span>
            {aggregateStatus && <StatusBadge status={aggregateStatus} />}

            {/* Trigger type badge */}
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-amber-400 border border-slate-700">
              {triggerLabel}
            </span>

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
            {pipeline.vcs.tag && (
              <span className="text-amber-500/70">
                {pipeline.vcs.tag}
              </span>
            )}
            {pipeline.trigger.actor.login && (
              <span>by {pipeline.trigger.actor.login}</span>
            )}
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

function classifyTrigger(t: TriggeredPipeline): Exclude<GroupKey, 'all'> {
  if (t.pipeline.vcs.tag) return 'tag';
  const type = t.pipeline.trigger.type;
  if (type === 'api') return 'api';
  if (type === 'schedule' || type === 'scheduled_pipeline') return 'schedule';
  return 'other';
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
