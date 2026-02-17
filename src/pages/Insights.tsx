import { useState } from 'react';
import {
  useWorkflowInsights,
  useWorkflowRuns,
  useFlakyTests,
  useTestMetrics,
  useJobInsights,
} from '../hooks/useCircleCI';
import { ErrorDisplay, Skeleton } from '../components/Layout';
import { formatDuration } from '../utils/format';
import type { WorkflowMetrics, WorkflowRun, FlakyTest, TestMetricItem, JobMetrics } from '../types/circleci';

type ReportingWindow = 'last-7-days' | 'last-30-days' | 'last-60-days' | 'last-90-days';

const WINDOWS: { value: ReportingWindow; label: string }[] = [
  { value: 'last-7-days', label: '7 days' },
  { value: 'last-30-days', label: '30 days' },
  { value: 'last-60-days', label: '60 days' },
  { value: 'last-90-days', label: '90 days' },
];

export function Insights() {
  const [window, setWindow] = useState<ReportingWindow>('last-30-days');
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  const { data: workflows, loading, error, refetch } = useWorkflowInsights(window);

  // Auto-select first workflow once loaded
  const activeWorkflow = selectedWorkflow ?? workflows?.[0]?.name ?? null;

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Insights</h2>
          <p className="text-sm text-slate-500 mt-1">Workflow metrics, trends, and test health</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Reporting window selector */}
          <div className="flex bg-slate-800 rounded-lg p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindow(w.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  window === w.value
                    ? 'bg-ocean-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            onClick={refetch}
            className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Workflow health cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-5 border border-slate-800">
              <Skeleton className="h-4 w-32 mb-3" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : workflows && workflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {workflows.map((wf) => (
            <WorkflowHealthCard
              key={wf.name}
              workflow={wf}
              selected={activeWorkflow === wf.name}
              onClick={() => setSelectedWorkflow(wf.name)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg p-8 border border-slate-800 text-center text-slate-500 mb-8">
          No workflow insights available for this time window.
        </div>
      )}

      {/* Detail sections for selected workflow */}
      {activeWorkflow && (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-slate-200 mb-1">
              {activeWorkflow}
            </h3>
            <p className="text-sm text-slate-500">
              Run history and detailed metrics
            </p>
          </div>

          {/* Duration trend chart + Job breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <DurationTrendChart workflowName={activeWorkflow} />
            <JobBreakdown workflowName={activeWorkflow} reportingWindow={window} />
          </div>

          {/* Flaky tests + Test metrics side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <FlakyTestsSection />
            <TestMetricsSection workflowName={activeWorkflow} />
          </div>
        </>
      )}
    </div>
  );
}

/** Workflow health card showing key metrics */
function WorkflowHealthCard({
  workflow,
  selected,
  onClick,
}: {
  workflow: WorkflowMetrics;
  selected: boolean;
  onClick: () => void;
}) {
  const m = workflow.metrics;
  const successRate = m.total_runs > 0
    ? Math.round((m.successful_runs / m.total_runs) * 100)
    : 0;

  // Color based on success rate
  const rateColor =
    successRate >= 90 ? 'text-emerald-400' :
    successRate >= 70 ? 'text-amber-400' :
    'text-red-400';

  const rateBg =
    successRate >= 90 ? 'bg-emerald-400' :
    successRate >= 70 ? 'bg-amber-400' :
    'bg-red-400';

  return (
    <button
      onClick={onClick}
      className={`text-left bg-slate-900 rounded-lg p-5 border transition-all hover:border-slate-600 ${
        selected ? 'border-ocean-500 ring-1 ring-ocean-500/30' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-slate-200 truncate pr-2">{workflow.name}</h4>
        <span className={`text-2xl font-bold ${rateColor}`}>{successRate}%</span>
      </div>

      {/* Success rate bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full ${rateBg} rounded-full transition-all`}
          style={{ width: `${successRate}%` }}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-slate-500 mb-0.5">Runs</div>
          <div className="text-slate-200 font-medium">{m.total_runs}</div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">Failed</div>
          <div className="text-red-400 font-medium">{m.failed_runs}</div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">Throughput</div>
          <div className="text-slate-200 font-medium">{m.throughput.toFixed(1)}/day</div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">Median</div>
          <div className="text-slate-200 font-medium">{formatDuration(m.duration_metrics.median * 1000)}</div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">p95</div>
          <div className="text-slate-200 font-medium">{formatDuration(m.duration_metrics.p95 * 1000)}</div>
        </div>
        <div>
          <div className="text-slate-500 mb-0.5">MTTR</div>
          <div className="text-slate-200 font-medium">{m.mttr > 0 ? formatDuration(m.mttr * 1000) : '—'}</div>
        </div>
      </div>

      {/* Credits */}
      {m.total_credits_used > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-500">
          {m.total_credits_used.toLocaleString()} credits used
        </div>
      )}
    </button>
  );
}

/** Duration trend chart showing recent runs as a bar chart */
function DurationTrendChart({ workflowName }: { workflowName: string }) {
  const { data: runs, loading, error } = useWorkflowRuns(workflowName);

  return (
    <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
      <h4 className="text-sm font-medium text-slate-300 mb-4">Duration Trend</h4>

      {loading ? (
        <div className="h-40 flex items-end gap-1">
          {[40, 65, 30, 80, 55, 45, 70, 35, 60, 50, 75, 42, 68, 38, 72, 48, 62, 33, 78, 52].map((h, i) => (
            <div key={i} className="flex-1 skeleton rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : error ? (
        <div className="h-40 flex items-center justify-center text-sm text-slate-500">{error}</div>
      ) : runs && runs.length > 0 ? (
        <RunsBarChart runs={runs} />
      ) : (
        <div className="h-40 flex items-center justify-center text-sm text-slate-500">
          No run data available
        </div>
      )}
    </div>
  );
}

/** Bar chart of workflow run durations */
function RunsBarChart({ runs }: { runs: WorkflowRun[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Show most recent 40 runs, oldest first for left-to-right timeline
  const displayRuns = runs.slice(0, 40).reverse();
  const maxDuration = Math.max(...displayRuns.map((r) => r.duration));

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-500';
      case 'failed': case 'error': return 'bg-red-500';
      case 'canceled': return 'bg-slate-500';
      default: return 'bg-sky-500';
    }
  };

  return (
    <div className="relative">
      <div className="h-40 flex items-end gap-px">
        {displayRuns.map((run, i) => {
          const height = maxDuration > 0 ? Math.max((run.duration / maxDuration) * 100, 3) : 3;
          return (
            <div
              key={run.id}
              className="flex-1 relative group"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div
                className={`w-full rounded-t transition-opacity ${statusColor(run.status)} ${
                  hoveredIdx !== null && hoveredIdx !== i ? 'opacity-40' : 'opacity-80'
                }`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && displayRuns[hoveredIdx] && (
        <RunTooltip run={displayRuns[hoveredIdx]} />
      )}

      {/* Time axis labels */}
      <div className="flex justify-between mt-2 text-xs text-slate-600">
        <span>{displayRuns[0] && new Date(displayRuns[0].created_at).toLocaleDateString()}</span>
        <span>{displayRuns[displayRuns.length - 1] && new Date(displayRuns[displayRuns.length - 1].created_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/** Tooltip for a hovered run bar */
function RunTooltip({ run }: { run: WorkflowRun }) {
  const statusColors: Record<string, string> = {
    success: 'text-emerald-400',
    failed: 'text-red-400',
    error: 'text-red-400',
    canceled: 'text-slate-400',
  };

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg z-10 whitespace-nowrap pointer-events-none">
      <div className="flex items-center gap-2 mb-1">
        <span className={statusColors[run.status] ?? 'text-sky-400'}>
          {run.status}
        </span>
        <span className="text-slate-500">
          {new Date(run.created_at).toLocaleString()}
        </span>
      </div>
      <div className="text-slate-300">
        Duration: {formatDuration(run.duration * 1000)}
      </div>
      {run.branch && (
        <div className="text-slate-500 mt-0.5">{run.branch}</div>
      )}
      {run.credits_used > 0 && (
        <div className="text-slate-500">{run.credits_used} credits</div>
      )}
    </div>
  );
}

/** Job breakdown within a workflow */
function JobBreakdown({
  workflowName,
  reportingWindow,
}: {
  workflowName: string;
  reportingWindow: string;
}) {
  const { data: jobs, loading, error } = useJobInsights(workflowName, reportingWindow);

  return (
    <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
      <h4 className="text-sm font-medium text-slate-300 mb-4">Job Breakdown</h4>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-slate-500">{error}</div>
      ) : jobs && jobs.length > 0 ? (
        <JobMetricsList jobs={jobs} />
      ) : (
        <div className="text-sm text-slate-500">No job data available</div>
      )}
    </div>
  );
}

/** List of job metrics with duration bars */
function JobMetricsList({ jobs }: { jobs: JobMetrics[] }) {
  // Sort by median duration descending (slowest first)
  const sorted = [...jobs].sort(
    (a, b) => b.metrics.duration_metrics.median - a.metrics.duration_metrics.median,
  );
  const maxMedian = sorted[0]?.metrics.duration_metrics.median ?? 1;

  return (
    <div className="space-y-2.5">
      {sorted.map((job) => {
        const m = job.metrics;
        const successRate = m.total_runs > 0
          ? Math.round((m.successful_runs / m.total_runs) * 100)
          : 0;
        const barWidth = maxMedian > 0
          ? Math.max((m.duration_metrics.median / maxMedian) * 100, 2)
          : 2;

        return (
          <div key={job.name}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-300 truncate mr-2 font-mono">{job.name}</span>
              <div className="flex items-center gap-3 shrink-0">
                <span className={
                  successRate >= 90 ? 'text-emerald-400' :
                  successRate >= 70 ? 'text-amber-400' :
                  'text-red-400'
                }>
                  {successRate}%
                </span>
                <span className="text-slate-500">{formatDuration(m.duration_metrics.median * 1000)}</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-ocean-500/60 rounded-full"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Flaky tests section */
function FlakyTestsSection() {
  const { data, loading, error } = useFlakyTests();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-slate-300">Flaky Tests</h4>
        {data && data.total_flaky_tests > 0 && (
          <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
            {data.total_flaky_tests} flaky
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-slate-500">{error}</div>
      ) : data && data.flaky_tests.length > 0 ? (
        <div className="space-y-2">
          {(expanded ? data.flaky_tests : data.flaky_tests.slice(0, 5)).map((test, i) => (
            <FlakyTestRow key={i} test={test} />
          ))}
          {data.flaky_tests.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-ocean-400 hover:text-ocean-300 transition-colors mt-2"
            >
              {expanded ? 'Show less' : `Show all ${data.flaky_tests.length} flaky tests`}
            </button>
          )}
        </div>
      ) : (
        <div className="text-sm text-slate-500 py-4 text-center">
          No flaky tests detected
        </div>
      )}
    </div>
  );
}

/** Single flaky test row */
function FlakyTestRow({ test }: { test: FlakyTest }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-200 font-medium truncate" title={test.test_name}>
            {test.test_name}
          </div>
          {test.file && (
            <div className="text-xs text-slate-500 font-mono truncate mt-0.5" title={test.file}>
              {test.file}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-amber-400 font-medium">
            {test.times_flaked}x flaked
          </div>
          {test.time_wasted > 0 && (
            <div className="text-xs text-slate-500 mt-0.5">
              {formatDuration(test.time_wasted * 1000)} wasted
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
        <span>{test.workflow_name}</span>
        <span className="text-slate-700">/</span>
        <span>{test.job_name}</span>
      </div>
    </div>
  );
}

/** Test metrics section (slowest / most failed) */
function TestMetricsSection({ workflowName }: { workflowName: string }) {
  const { data, loading, error } = useTestMetrics(workflowName);
  const [tab, setTab] = useState<'slowest' | 'failed'>('slowest');

  const items = tab === 'slowest' ? data?.slowest_tests : data?.most_failed_tests;

  return (
    <div className="bg-slate-900 rounded-lg p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-slate-300">Test Metrics</h4>
        <div className="flex bg-slate-800 rounded-md p-0.5">
          <button
            onClick={() => setTab('slowest')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              tab === 'slowest' ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Slowest
          </button>
          <button
            onClick={() => setTab('failed')}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              tab === 'failed' ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Most Failed
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-slate-500">{error}</div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 10).map((item, i) => (
            <TestMetricRow key={i} item={item} mode={tab} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 py-4 text-center">
          No test metrics available
        </div>
      )}
    </div>
  );
}

/** Single test metric row */
function TestMetricRow({ item, mode }: { item: TestMetricItem; mode: 'slowest' | 'failed' }) {
  const failRate = item.total_runs > 0
    ? Math.round((item.failed_runs / item.total_runs) * 100)
    : 0;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-slate-200 font-medium truncate" title={item.test_name}>
            {item.test_name}
          </div>
          {item.file && (
            <div className="text-xs text-slate-500 font-mono truncate mt-0.5" title={item.file}>
              {item.file}
            </div>
          )}
        </div>
        <div className="text-right shrink-0 text-xs">
          {mode === 'slowest' ? (
            <div className="text-slate-200 font-medium">
              p95: {formatDuration(item.p95_duration * 1000)}
            </div>
          ) : (
            <div className="text-red-400 font-medium">
              {failRate}% fail rate
            </div>
          )}
          <div className="text-slate-500 mt-0.5">
            {item.failed_runs}/{item.total_runs} runs
            {item.flaky && <span className="text-amber-400 ml-1.5">flaky</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
