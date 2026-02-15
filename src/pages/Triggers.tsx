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
import type { Workflow, WorkflowStatus } from '../types/circleci';

type FilterKey = 'all' | 'api' | 'schedule' | 'tag' | 'other';

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'All',
  api: 'API',
  schedule: 'Scheduled',
  tag: 'Tags',
  other: 'Other',
};

/** A group of triggered pipelines sharing a tag or commit SHA */
interface TriggerGroup {
  key: string;
  label: string;
  sublabel: string;
  items: TriggeredPipeline[];
  latestCreatedAt: string;
  worstStatus?: WorkflowStatus;
}

export function Triggers() {
  const { data: triggered, loading, error, refetch } = useTriggeredPipelines();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Count per filter for tabs
  const filterCounts = useMemo(() => {
    if (!triggered) return {} as Record<FilterKey, number>;
    const counts: Record<FilterKey, number> = { all: triggered.length, api: 0, schedule: 0, tag: 0, other: 0 };
    for (const t of triggered) {
      counts[classifyTrigger(t)]++;
    }
    return counts;
  }, [triggered]);

  // Filter then group
  const groups = useMemo(() => {
    if (!triggered) return [];
    const filtered = filter === 'all'
      ? triggered
      : triggered.filter((t) => classifyTrigger(t) === filter);
    return buildGroups(filtered);
  }, [triggered, filter]);

  // Auto-expand if only 1 group, or expand all single-item groups
  useEffect(() => {
    if (groups.length === 1) {
      setExpandedGroups(new Set([groups[0].key]));
    }
  }, [groups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
              Grouped by tag or commit. Expand a group to see individual runs.
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
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
            const count = filterCounts[key] ?? 0;
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
                {FILTER_LABELS[key]}
                <span className="ml-1.5 text-xs text-slate-500">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grouped list */}
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
      ) : groups.length === 0 ? (
        <EmptyState
          message={
            filter === 'all'
              ? 'No triggered pipelines found'
              : `No ${FILTER_LABELS[filter].toLowerCase()} pipelines found`
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <TriggerGroupCard
              key={group.key}
              group={group}
              isExpanded={expandedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A collapsible card representing a group of pipelines */
function TriggerGroupCard({
  group,
  isExpanded,
  onToggle,
}: {
  group: TriggerGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      {/* Group header - always visible, clickable */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors text-left"
      >
        {/* Expand/collapse chevron */}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>

        {/* Group label */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-semibold text-slate-100">{group.label}</span>

            {group.worstStatus && <StatusBadge status={group.worstStatus} />}

            <span className="text-sm text-slate-500">
              {group.items.length} run{group.items.length !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-0.5">{group.sublabel}</p>
        </div>

        {/* Time */}
        <span className="text-xs text-slate-600 shrink-0">
          {formatRelativeTime(group.latestCreatedAt)}
        </span>
      </button>

      {/* Expanded: individual pipeline runs */}
      {isExpanded && (
        <div className="border-t border-slate-800">
          {group.items.map((t) => (
            <TriggeredPipelineRow key={t.pipeline.id} triggered={t} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A single pipeline run inside an expanded group */
function TriggeredPipelineRow({ triggered }: { triggered: TriggeredPipeline }) {
  const { client } = useAuth();
  const { pipeline, triggerLabel } = triggered;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWf, setLoadingWf] = useState(true);
  const [expanded, setExpanded] = useState(false);

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
    <div className="border-b border-slate-800/50 last:border-b-0">
      {/* Pipeline summary row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors text-left"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>

        <span className="text-sm font-medium text-slate-300">
          #{pipeline.number}
        </span>

        {aggregateStatus && <StatusBadge status={aggregateStatus} />}

        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-amber-400 border border-slate-700">
          {triggerLabel}
        </span>

        {pipeline.vcs.commit?.subject && (
          <span className="text-xs text-slate-500 truncate min-w-0 hidden sm:inline">
            {truncate(pipeline.vcs.commit.subject, 50)}
          </span>
        )}

        <div className="flex-1" />

        {pipeline.trigger.actor.login && (
          <span className="text-xs text-slate-600 shrink-0 hidden sm:inline">
            {pipeline.trigger.actor.login}
          </span>
        )}

        <span className="text-xs text-slate-600 shrink-0">
          {formatRelativeTime(pipeline.created_at)}
        </span>
      </button>

      {/* Workflows (shown when expanded) */}
      {expanded && (
        <div className="bg-slate-950/50 border-t border-slate-800/50">
          {loadingWf ? (
            <div className="px-6 py-3">
              <Skeleton className="h-8 w-full" />
            </div>
          ) : workflows.length > 0 ? (
            workflows.map((wf) => (
              <Link
                key={wf.id}
                to={`/pipeline/${pipeline.id}/workflow/${wf.id}`}
                className="flex items-center gap-4 px-6 py-2.5 hover:bg-slate-800/50 transition-colors border-b border-slate-800/30 last:border-b-0"
              >
                <StatusBadge status={wf.status} />
                <span className="text-sm text-slate-300">{wf.name}</span>
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
            ))
          ) : (
            <div className="px-6 py-3 text-xs text-slate-600">No workflows</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Build groups from a list of triggered pipelines */
function buildGroups(items: TriggeredPipeline[]): TriggerGroup[] {
  const groupMap = new Map<string, TriggerGroup>();

  for (const t of items) {
    const pipeline = t.pipeline;
    // Group key: tag takes priority, otherwise commit SHA
    const key = pipeline.vcs.tag
      ? `tag:${pipeline.vcs.tag}`
      : `sha:${pipeline.vcs.revision}`;

    if (!groupMap.has(key)) {
      const label = pipeline.vcs.tag
        ? pipeline.vcs.tag
        : shortSha(pipeline.vcs.revision);
      const sublabel = pipeline.vcs.tag
        ? `Tag — ${shortSha(pipeline.vcs.revision)}${pipeline.vcs.commit?.subject ? ' — ' + truncate(pipeline.vcs.commit.subject, 60) : ''}`
        : pipeline.vcs.commit?.subject
          ? truncate(pipeline.vcs.commit.subject, 70)
          : 'No commit message';

      groupMap.set(key, {
        key,
        label,
        sublabel,
        items: [],
        latestCreatedAt: pipeline.created_at,
        worstStatus: undefined,
      });
    }

    const group = groupMap.get(key)!;
    group.items.push(t);

    // Track latest created_at
    if (new Date(pipeline.created_at) > new Date(group.latestCreatedAt)) {
      group.latestCreatedAt = pipeline.created_at;
    }

    // Track worst status
    if (t.workflowStatus) {
      group.worstStatus = group.worstStatus
        ? pickWorstStatus(group.worstStatus, t.workflowStatus)
        : t.workflowStatus;
    }
  }

  // Sort groups: most recent first
  const groups = Array.from(groupMap.values());
  groups.sort(
    (a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime(),
  );

  // Sort items within each group by time (newest first)
  for (const group of groups) {
    group.items.sort(
      (a, b) => new Date(b.pipeline.created_at).getTime() - new Date(a.pipeline.created_at).getTime(),
    );
  }

  return groups;
}

function classifyTrigger(t: TriggeredPipeline): Exclude<FilterKey, 'all'> {
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

const STATUS_PRIORITY: WorkflowStatus[] = [
  'failed', 'error', 'failing', 'running', 'on_hold',
  'canceled', 'not_run', 'unauthorized', 'success',
];

function pickWorstStatus(a: WorkflowStatus, b: WorkflowStatus): WorkflowStatus {
  const ai = STATUS_PRIORITY.indexOf(a);
  const bi = STATUS_PRIORITY.indexOf(b);
  return ai <= bi ? a : b;
}
