import type { CIStatus } from '../types/circleci';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  success:              { color: 'text-emerald-400', bg: 'bg-emerald-400', label: 'Success',     icon: '✓' },
  running:              { color: 'text-sky-400',     bg: 'bg-sky-400',     label: 'Running',     icon: '⟳' },
  failing:              { color: 'text-orange-400',  bg: 'bg-orange-400',  label: 'Failing',     icon: '!' },
  failed:               { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Failed',      icon: '✗' },
  error:                { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Error',       icon: '✗' },
  errored:              { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Errored',     icon: '✗' },
  on_hold:              { color: 'text-amber-400',   bg: 'bg-amber-400',   label: 'On Hold',     icon: '⏸' },
  canceled:             { color: 'text-slate-400',   bg: 'bg-slate-400',   label: 'Canceled',    icon: '⊘' },
  not_run:              { color: 'text-slate-500',   bg: 'bg-slate-500',   label: 'Not Run',     icon: '○' },
  blocked:              { color: 'text-slate-500',   bg: 'bg-slate-500',   label: 'Blocked',     icon: '⊜' },
  queued:               { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Queued',      icon: '◷' },
  not_running:          { color: 'text-slate-500',   bg: 'bg-slate-500',   label: 'Not Running', icon: '○' },
  infrastructure_fail:  { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Infra Fail',  icon: '✗' },
  timedout:             { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Timed Out',   icon: '⏱' },
  retried:              { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Retried',     icon: '↻' },
  unauthorized:         { color: 'text-red-400',     bg: 'bg-red-400',     label: 'Unauthorized',icon: '⊘' },
  'terminated-unknown': { color: 'text-slate-400',   bg: 'bg-slate-400',   label: 'Terminated',  icon: '✗' },
  created:              { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Created',     icon: '◷' },
  pending:              { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Pending',     icon: '◷' },
  'setup-pending':      { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Setup',       icon: '◷' },
  setup:                { color: 'text-blue-400',    bg: 'bg-blue-400',    label: 'Setup',       icon: '◷' },
};

const DEFAULT_CONFIG = { color: 'text-slate-400', bg: 'bg-slate-400', label: 'Unknown', icon: '?' };

function getConfig(status: CIStatus) {
  return STATUS_CONFIG[status] ?? DEFAULT_CONFIG;
}

/** Inline badge showing status dot + label */
export function StatusBadge({ status }: { status: CIStatus }) {
  const cfg = getConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${cfg.color}`}>
      <span
        className={`inline-block w-2 h-2 rounded-full ${cfg.bg} ${
          status === 'running' ? 'animate-pulse' : ''
        }`}
      />
      {cfg.label}
    </span>
  );
}

/** Returns the fill color for SVG graph nodes */
export function getStatusFill(status: CIStatus): string {
  const fills: Record<string, string> = {
    success:             '#34d399',
    running:             '#38bdf8',
    failing:             '#fb923c',
    failed:              '#f87171',
    error:               '#f87171',
    errored:             '#f87171',
    on_hold:             '#fbbf24',
    canceled:            '#94a3b8',
    not_run:             '#475569',
    blocked:             '#475569',
    queued:              '#60a5fa',
    not_running:         '#475569',
    infrastructure_fail: '#f87171',
    timedout:            '#f87171',
    retried:             '#60a5fa',
    unauthorized:        '#f87171',
    created:             '#60a5fa',
    pending:             '#60a5fa',
  };
  return fills[status] ?? '#475569';
}

/** Status icon character for SVG text */
export function getStatusIcon(status: CIStatus): string {
  return getConfig(status).icon;
}

/** Whether this status represents an active/in-progress state */
export function isActiveStatus(status: CIStatus): boolean {
  return ['running', 'failing', 'queued', 'not_running', 'created', 'pending', 'setup-pending', 'setup'].includes(status);
}
