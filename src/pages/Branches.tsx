import { Link } from 'react-router-dom';
import { useBranches } from '../hooks/useCircleCI';
import { StatusBadge, isActiveStatus } from '../components/StatusBadge';
import { ErrorDisplay, EmptyState, Skeleton } from '../components/Layout';
import { formatRelativeTime, truncate, shortSha } from '../utils/format';

export function Branches() {
  const { data, loading, error, refetch } = useBranches();
  const branches = data?.branches;
  const triggeredCount = data?.triggeredCount ?? 0;

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-100">Branches</h2>
        <div className="flex items-center gap-4">
          <Link
            to="/insights"
            className="text-sm text-ocean-400 hover:text-ocean-300 transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M1 11a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-3Zm5-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm5-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2Z" />
            </svg>
            Insights
          </Link>
          <button
            onClick={refetch}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : branches && branches.length === 0 && triggeredCount === 0 ? (
        <EmptyState message="No pipelines found for this project" />
      ) : (
        <div className="space-y-2">
          {branches?.map((branch) => {
            const pipeline = branch.latestPipeline;
            const isActive = branch.latestWorkflowStatus && isActiveStatus(branch.latestWorkflowStatus);

            return (
              <Link
                key={branch.name}
                to={`/branches/${encodeURIComponent(branch.name)}`}
                className={`block bg-slate-900 rounded-lg p-4 border transition-all hover:border-slate-600 ${
                  isActive
                    ? 'border-sky-900/50 hover:border-sky-700/50'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Branch icon */}
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4 text-slate-500 shrink-0"
                  >
                    <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
                  </svg>

                  {/* Branch name */}
                  <span className="font-medium text-slate-100 min-w-0 truncate">
                    {branch.name}
                  </span>

                  {/* Workflow status */}
                  {branch.latestWorkflowStatus && (
                    <StatusBadge status={branch.latestWorkflowStatus} />
                  )}

                  {/* Recent pipeline count */}
                  {branch.recentPipelineCount > 1 && (
                    <span className="text-xs text-slate-500">
                      {branch.recentPipelineCount} recent
                    </span>
                  )}

                  <div className="flex-1" />

                  {/* Commit info */}
                  <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500 shrink-0">
                    {pipeline.vcs.commit?.subject && (
                      <span className="truncate max-w-[200px]">
                        {truncate(pipeline.vcs.commit.subject, 40)}
                      </span>
                    )}
                    <code className="text-xs text-slate-600">
                      {shortSha(pipeline.vcs.revision)}
                    </code>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-slate-600 shrink-0">
                    {formatRelativeTime(pipeline.created_at)}
                  </span>

                  {/* Arrow */}
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
                </div>

                {/* Mobile commit info */}
                <div className="sm:hidden mt-2 flex items-center gap-2 text-xs text-slate-500">
                  {pipeline.vcs.commit?.subject && (
                    <span className="truncate">
                      {truncate(pipeline.vcs.commit.subject, 50)}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Triggered pipelines link */}
          {triggeredCount > 0 && (
            <>
              <div className="pt-4 pb-1">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Other Triggers
                </h3>
              </div>
              <Link
                to="/triggers"
                className="block bg-slate-900 rounded-lg p-4 border border-slate-800 transition-all hover:border-slate-600"
              >
                <div className="flex items-center gap-4">
                  {/* Trigger icon (lightning bolt) */}
                  <svg
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className="w-4 h-4 text-amber-500 shrink-0"
                  >
                    <path d="M9.585 2.568a.5.5 0 0 1 .226.58L8.677 6.832h3.596a.5.5 0 0 1 .378.83l-6.5 7.5a.5.5 0 0 1-.88-.458L6.39 11.168H2.793a.5.5 0 0 1-.378-.83l6.5-7.5a.5.5 0 0 1 .67-.27Z" />
                  </svg>

                  <span className="font-medium text-slate-100">
                    Triggered Pipelines
                  </span>

                  <span className="text-sm text-slate-500">
                    {triggeredCount} pipeline{triggeredCount !== 1 ? 's' : ''}
                  </span>

                  <span className="text-xs text-slate-600">
                    API, scheduled, tags, webhooks
                  </span>

                  <div className="flex-1" />

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
                </div>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
