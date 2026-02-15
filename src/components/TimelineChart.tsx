import { useMemo } from 'react';
import type { Job } from '../types/circleci';
import { getStatusFill } from './StatusBadge';
import { formatDuration } from '../utils/format';

interface Props {
  jobs: Job[];
  selectedJobId?: string | null;
  onSelectJob: (job: Job) => void;
}

const BAR_HEIGHT = 24;
const ROW_HEIGHT = 36;
const LABEL_WIDTH = 140;
const CHART_PADDING = 16;

export function TimelineChart({ jobs, selectedJobId, onSelectJob }: Props) {
  const { bars, totalDurationMs, chartWidth } = useMemo(
    () => computeTimeline(jobs),
    [jobs],
  );

  if (bars.length === 0) {
    return null;
  }

  const svgHeight = CHART_PADDING * 2 + bars.length * ROW_HEIGHT;
  const svgWidth = LABEL_WIDTH + chartWidth + CHART_PADDING * 2;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width={svgWidth}
        height={svgHeight}
        className="max-w-full"
        style={{ minWidth: Math.min(svgWidth, 300) }}
      >
        {/* Time axis grid lines */}
        {generateGridLines(totalDurationMs, chartWidth).map((line) => (
          <g key={line.x}>
            <line
              x1={LABEL_WIDTH + line.x}
              y1={CHART_PADDING - 4}
              x2={LABEL_WIDTH + line.x}
              y2={svgHeight - CHART_PADDING}
              stroke="#1e293b"
              strokeWidth={1}
            />
            <text
              x={LABEL_WIDTH + line.x}
              y={CHART_PADDING - 8}
              textAnchor="middle"
              fill="#475569"
              fontSize="10"
            >
              {line.label}
            </text>
          </g>
        ))}

        {/* Job bars */}
        {bars.map((bar, i) => {
          const y = CHART_PADDING + i * ROW_HEIGHT;
          const isSelected = selectedJobId === bar.job.id;

          return (
            <g
              key={bar.job.id}
              className="cursor-pointer"
              onClick={() => onSelectJob(bar.job)}
            >
              {/* Row highlight */}
              {isSelected && (
                <rect
                  x={0}
                  y={y - 2}
                  width={svgWidth}
                  height={ROW_HEIGHT}
                  fill="#1e293b"
                  rx={4}
                />
              )}

              {/* Job name label */}
              <text
                x={LABEL_WIDTH - 8}
                y={y + BAR_HEIGHT / 2 + 2}
                textAnchor="end"
                fill={isSelected ? '#e2e8f0' : '#94a3b8'}
                fontSize="11"
                className="select-none"
              >
                {truncLabel(bar.job.name, 16)}
              </text>

              {/* Duration bar */}
              <rect
                x={LABEL_WIDTH + bar.startX}
                y={y + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                width={Math.max(bar.width, 3)}
                height={BAR_HEIGHT}
                rx={4}
                fill={getStatusFill(bar.job.status)}
                opacity={isSelected ? 1 : 0.75}
              />

              {/* Duration text inside bar */}
              {bar.width > 40 && (
                <text
                  x={LABEL_WIDTH + bar.startX + bar.width / 2}
                  y={y + ROW_HEIGHT / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="10"
                  fontWeight="500"
                  className="select-none pointer-events-none"
                >
                  {bar.durationLabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface BarData {
  job: Job;
  startX: number;
  width: number;
  durationLabel: string;
}

function computeTimeline(jobs: Job[]): {
  bars: BarData[];
  totalDurationMs: number;
  chartWidth: number;
} {
  // Only include jobs that have timing data
  const timedJobs = jobs.filter((j) => j.started_at);
  if (timedJobs.length === 0) {
    return { bars: [], totalDurationMs: 0, chartWidth: 0 };
  }

  // Find the global start time
  const startTimes = timedJobs.map((j) => new Date(j.started_at!).getTime());
  const globalStart = Math.min(...startTimes);

  const endTimes = timedJobs.map((j) =>
    j.stopped_at ? new Date(j.stopped_at).getTime() : Date.now(),
  );
  const globalEnd = Math.max(...endTimes);
  const totalDurationMs = globalEnd - globalStart;

  // Chart width: target ~500px, min 200px
  const chartWidth = Math.max(200, Math.min(600, totalDurationMs / 100));

  // Sort by start time
  const sorted = [...timedJobs].sort(
    (a, b) => new Date(a.started_at!).getTime() - new Date(b.started_at!).getTime(),
  );

  const bars: BarData[] = sorted.map((job) => {
    const jobStart = new Date(job.started_at!).getTime();
    const jobEnd = job.stopped_at ? new Date(job.stopped_at).getTime() : Date.now();
    const jobDuration = jobEnd - jobStart;

    const startFraction = totalDurationMs > 0 ? (jobStart - globalStart) / totalDurationMs : 0;
    const widthFraction = totalDurationMs > 0 ? jobDuration / totalDurationMs : 1;

    return {
      job,
      startX: startFraction * chartWidth,
      width: widthFraction * chartWidth,
      durationLabel: formatDuration(jobDuration),
    };
  });

  return { bars, totalDurationMs, chartWidth };
}

function generateGridLines(
  totalMs: number,
  chartWidth: number,
): Array<{ x: number; label: string }> {
  if (totalMs === 0 || chartWidth === 0) return [];

  // Aim for ~4-6 grid lines
  const intervals = [5000, 10000, 30000, 60000, 120000, 300000, 600000];
  let interval = intervals.find((i) => totalMs / i <= 8) ?? totalMs / 4;
  if (interval <= 0) interval = totalMs;

  const lines: Array<{ x: number; label: string }> = [];
  for (let t = 0; t <= totalMs; t += interval) {
    lines.push({
      x: (t / totalMs) * chartWidth,
      label: formatDuration(t),
    });
  }
  return lines;
}

function truncLabel(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '\u2026';
}
