import type { Job, JobDetail } from '../types/circleci';
import { StatusBadge } from './StatusBadge';
import { Skeleton } from './Layout';
import { useJobDetail } from '../hooks/useCircleCI';
import { formatDurationBetween, formatRelativeTime } from '../utils/format';

interface Props {
  job: Job;
  onClose: () => void;
}

export function JobPanel({ job, onClose }: Props) {
  const { data: detail, loading } = useJobDetail(job.job_number ?? null);

  return (
    <div className="bg-slate-900 border-l border-slate-800 w-80 shrink-0 flex flex-col h-full overflow-hidden">
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
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ) : detail ? (
          <>
            {/* Executor */}
            <Section title="Executor">
              <InfoRow label="Type" value={detail.executor.type} />
              <InfoRow label="Resource" value={detail.executor.resource_class} />
              {detail.parallelism > 1 && (
                <InfoRow label="Parallelism" value={String(detail.parallelism)} />
              )}
            </Section>

            {/* Contexts */}
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

            {/* Messages */}
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

            {/* Link to CircleCI */}
            {detail.web_url && (
              <a
                href={detail.web_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-ocean-400 hover:text-ocean-300 transition-colors"
              >
                View full details in CircleCI
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path
                    fillRule="evenodd"
                    d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 01-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            )}
          </>
        ) : null}

        {/* Job type badge */}
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
