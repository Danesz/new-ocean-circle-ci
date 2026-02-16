import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Job, TestResult, Artifact, BuildStep } from '../types/circleci';
import { StatusBadge } from './StatusBadge';
import { Skeleton } from './Layout';
import { useJobDetail, useJobTests, useJobArtifacts, useBuildSteps } from '../hooks/useCircleCI';
import { useAuth } from '../context/AuthContext';
import { formatDuration, formatDurationBetween, formatRelativeTime } from '../utils/format';

interface Props {
  job: Job;
  onClose: () => void;
}

export function JobPanel({ job, onClose }: Props) {
  const jobNum = job.job_number ?? null;
  const { data: detail, loading: detailLoading } = useJobDetail(jobNum);
  const { data: tests } = useJobTests(jobNum);
  const { data: artifacts } = useJobArtifacts(jobNum);
  const { data: buildDetail } = useBuildSteps(jobNum);

  const failedTests = tests?.filter((t) => t.result === 'failure') ?? [];
  const skippedTests = tests?.filter((t) => t.result === 'skipped') ?? [];
  const passedTests = tests?.filter((t) => t.result === 'success') ?? [];
  const steps = buildDetail?.steps ?? [];

  // Find the "interesting" step to auto-expand:
  // - First failed/timedout step, OR
  // - The longest-running step (for successful builds)
  const autoExpandIndex = useMemo(() => {
    if (steps.length === 0) return -1;

    const failedIdx = steps.findIndex((s) => {
      const a = s.actions[0];
      return a && (a.status === 'failed' || a.status === 'timedout');
    });
    if (failedIdx !== -1) return failedIdx;

    // For non-failed builds, auto-expand the longest step
    let longestIdx = -1;
    let longestTime = 0;
    steps.forEach((s, i) => {
      const a = s.actions[0];
      if (a?.run_time_millis && a.run_time_millis > longestTime && a.has_output) {
        longestTime = a.run_time_millis;
        longestIdx = i;
      }
    });
    return longestIdx;
  }, [steps]);

  // Total step duration for timeline bars
  const totalStepDuration = useMemo(() => {
    return steps.reduce((sum, s) => sum + (s.actions[0]?.run_time_millis ?? 0), 0);
  }, [steps]);

  return (
    <div className="bg-slate-900 border-l border-slate-800 w-96 shrink-0 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-100 truncate">{job.name}</h3>
          <div className="mt-1">
            <StatusBadge status={job.status} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors ml-2 p-1 shrink-0"
          aria-label="Close panel"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timing */}
        <Section title="Timing">
          <InfoRow label="Duration" value={formatDurationBetween(job.started_at, job.stopped_at)} />
          {job.started_at && (
            <InfoRow label="Started" value={formatRelativeTime(job.started_at)} />
          )}
          {job.stopped_at && (
            <InfoRow label="Finished" value={formatRelativeTime(job.stopped_at)} />
          )}
          {job.job_number && (
            <InfoRow label="Job #" value={String(job.job_number)} />
          )}
        </Section>

        {/* Job Detail (from API) */}
        {detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : detail ? (
          <>
            <Section title="Executor">
              <InfoRow label="Type" value={detail.executor.type} />
              <InfoRow label="Resource" value={detail.executor.resource_class} />
              {detail.parallelism > 1 && (
                <InfoRow label="Parallelism" value={String(detail.parallelism)} />
              )}
            </Section>

            {detail.contexts.length > 0 && (
              <Section title="Contexts">
                <div className="flex flex-wrap gap-1.5">
                  {detail.contexts.map((ctx) => (
                    <span
                      key={ctx.name}
                      className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-300"
                    >
                      {ctx.name}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {detail.messages.length > 0 && (
              <Section title="Messages">
                {detail.messages.map((msg, i) => (
                  <div
                    key={i}
                    className="text-xs p-2 bg-slate-800 rounded text-slate-300"
                  >
                    <span className="text-slate-500">[{msg.type}]</span>{' '}
                    {msg.message}
                  </div>
                ))}
              </Section>
            )}
          </>
        ) : null}

        {/* Test summary */}
        {tests && tests.length > 0 && (
          <Section title={`Tests (${tests.length})`}>
            {/* Summary bar */}
            <TestSummaryBar
              passed={passedTests.length}
              failed={failedTests.length}
              skipped={skippedTests.length}
            />

            {/* Failed tests (expandable) */}
            {failedTests.length > 0 && (
              <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
                {failedTests.map((test, i) => (
                  <FailedTestCard key={i} test={test} />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Step duration timeline */}
        {steps.length > 0 && totalStepDuration > 0 && (
          <Section title="Step Timeline">
            <StepTimeline steps={steps} totalDuration={totalStepDuration} />
          </Section>
        )}

        {/* Steps with logs */}
        {steps.length > 0 && (
          <Section title={`Steps (${steps.length})`}>
            <div className="space-y-1">
              {steps.map((step, i) => (
                <StepRow
                  key={i}
                  step={step}
                  defaultExpanded={i === autoExpandIndex}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Artifacts */}
        {artifacts && artifacts.length > 0 && (
          <Section title={`Artifacts (${artifacts.length})`}>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {artifacts.map((artifact, i) => (
                <ArtifactRow key={i} artifact={artifact} />
              ))}
            </div>
          </Section>
        )}

        {/* Link to CircleCI */}
        {detail?.web_url && (
          <a
            href={detail.web_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300 transition-colors"
          >
            View full details in CircleCI
            <ExternalLinkIcon />
          </a>
        )}

        {/* Approval badge */}
        {job.type === 'approval' && (
          <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg text-sm text-amber-300">
            This is an approval job. It requires manual approval to continue the
            workflow.
          </div>
        )}
      </div>
    </div>
  );
}

/** Visual pass/fail/skip bar with counts */
function TestSummaryBar({
  passed,
  failed,
  skipped,
}: {
  passed: number;
  failed: number;
  skipped: number;
}) {
  const total = passed + failed + skipped;
  if (total === 0) return null;

  const pctPassed = (passed / total) * 100;
  const pctFailed = (failed / total) * 100;
  const pctSkipped = (skipped / total) * 100;

  return (
    <div>
      {/* Stacked bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
        {pctPassed > 0 && (
          <div
            className="bg-emerald-500 transition-all"
            style={{ width: `${pctPassed}%` }}
          />
        )}
        {pctFailed > 0 && (
          <div
            className="bg-red-500 transition-all"
            style={{ width: `${pctFailed}%` }}
          />
        )}
        {pctSkipped > 0 && (
          <div
            className="bg-slate-600 transition-all"
            style={{ width: `${pctSkipped}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1.5 text-xs">
        {passed > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-400">{passed} passed</span>
          </span>
        )}
        {failed > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400">{failed} failed</span>
          </span>
        )}
        {skipped > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-slate-500">{skipped} skipped</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Horizontal bar chart of step durations */
function StepTimeline({
  steps,
  totalDuration,
}: {
  steps: BuildStep[];
  totalDuration: number;
}) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const action = step.actions[0];
        if (!action) return null;

        const ms = action.run_time_millis ?? 0;
        const pct = totalDuration > 0 ? (ms / totalDuration) * 100 : 0;
        const isFailed = action.status === 'failed' || action.status === 'timedout';

        // Skip steps with negligible duration
        if (pct < 1 && !isFailed) return null;

        const barColor = isFailed
          ? 'bg-red-500'
          : action.status === 'success'
            ? 'bg-emerald-500/70'
            : action.status === 'running'
              ? 'bg-sky-500'
              : 'bg-slate-700';

        return (
          <div key={i} className="flex items-center gap-2">
            <span
              className={`text-xs truncate w-24 shrink-0 ${isFailed ? 'text-red-400' : 'text-slate-500'}`}
              title={step.name}
            >
              {step.name}
            </span>
            <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor} transition-all`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className={`text-xs w-10 text-right shrink-0 ${isFailed ? 'text-red-400' : 'text-slate-600'}`}>
              {ms > 0 ? formatDuration(ms) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A single failed test */
function FailedTestCard({ test }: { test: TestResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-red-950/30 border border-red-900/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-2 flex items-start gap-2"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-3 h-3 text-red-400 mt-0.5 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
        <div className="min-w-0">
          <div className="text-xs text-red-300 font-medium truncate">
            {test.classname ? `${test.classname} > ` : ''}{test.name}
          </div>
          {test.file && (
            <div className="text-xs text-red-400/60 truncate">{test.file}</div>
          )}
        </div>
      </button>
      {expanded && test.message && (
        <div className="px-3 pb-2">
          <pre className="text-xs text-red-200/80 bg-red-950/50 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
            {test.message}
          </pre>
        </div>
      )}
    </div>
  );
}

/** A single step row with expandable log */
function StepRow({
  step,
  defaultExpanded,
}: {
  step: BuildStep;
  defaultExpanded: boolean;
}) {
  const { client } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [log, setLog] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  const action = step.actions[0]; // Primary action
  if (!action) return null;

  const isFailed = action.status === 'failed' || action.status === 'timedout';
  const duration = action.run_time_millis ? formatDuration(action.run_time_millis) : null;

  const statusColor = isFailed
    ? 'text-red-400'
    : action.status === 'success'
      ? 'text-emerald-400'
      : action.status === 'running'
        ? 'text-sky-400'
        : 'text-slate-500';

  const statusIcon = isFailed ? '\u2717' : action.status === 'success' ? '\u2713' : '\u25CB';

  const loadLog = useCallback(async () => {
    if (!client || !action.output_url || log !== null) return;
    setLogLoading(true);
    try {
      const output = await client.getStepLog(action.output_url);
      setLog(output.map((o) => o.message).join(''));
    } catch {
      setLog('(failed to load log)');
    } finally {
      setLogLoading(false);
    }
  }, [client, action.output_url, log]);

  // Auto-load log when defaultExpanded
  useEffect(() => {
    if (defaultExpanded && action.has_output && log === null) {
      loadLog();
    }
  }, [defaultExpanded, action.has_output, log, loadLog]);

  const handleToggle = () => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && log === null && action.has_output) {
      loadLog();
    }
  };

  return (
    <div className={`rounded ${isFailed ? 'bg-red-950/20' : ''}`}>
      <button
        onClick={handleToggle}
        className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-slate-800/50 rounded transition-colors"
      >
        <span className={`text-xs shrink-0 w-3 text-center ${statusColor}`}>
          {statusIcon}
        </span>
        <span className={`text-xs flex-1 truncate ${isFailed ? 'text-red-300' : 'text-slate-300'}`}>
          {step.name}
        </span>
        {duration && (
          <span className="text-xs text-slate-600 shrink-0">{duration}</span>
        )}
        {action.has_output && (
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-3 h-3 text-slate-600 shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
      {expanded && action.has_output && (
        <div className="px-2 pb-2">
          {logLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : log ? (
            <pre className="text-xs bg-slate-950 border border-slate-800 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words text-slate-300 font-mono leading-relaxed">
              {log}
            </pre>
          ) : (
            <div className="text-xs text-slate-600 p-2">No output</div>
          )}
        </div>
      )}
    </div>
  );
}

/** A single artifact download link */
function ArtifactRow({ artifact }: { artifact: Artifact }) {
  const filename = artifact.path.split('/').pop() ?? artifact.path;

  return (
    <a
      href={artifact.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-2 py-1.5 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors group"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 text-slate-500 shrink-0">
        <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
        <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
      </svg>
      <span className="text-xs text-slate-300 group-hover:text-slate-100 truncate flex-1">
        {filename}
      </span>
      <span className="text-xs text-slate-600 truncate max-w-[120px]" title={artifact.path}>
        {artifact.path}
      </span>
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200 font-mono text-xs">{value}</span>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}
