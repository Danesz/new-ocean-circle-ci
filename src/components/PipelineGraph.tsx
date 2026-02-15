import { useMemo, useState } from 'react';
import type { Job, GraphNode, GraphEdge } from '../types/circleci';
import { getStatusFill, getStatusIcon, isActiveStatus } from './StatusBadge';
import { formatDurationBetween } from '../utils/format';

const NODE_RADIUS = 22;
const COL_SPACING = 160;
const ROW_SPACING = 72;
const PADDING_X = 50;
const PADDING_Y = 50;

interface Props {
  jobs: Job[];
  selectedJobId?: string | null;
  onSelectJob: (job: Job) => void;
}

export function PipelineGraph({ jobs, selectedJobId, onSelectJob }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { nodes, edges, width, height } = useMemo(
    () => layoutGraph(jobs),
    [jobs],
  );

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        No jobs found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full"
        style={{ minWidth: Math.min(width, 400) }}
      >
        {/* Edges */}
        {edges.map((edge) => (
          <Edge
            key={`${edge.from}-${edge.to}`}
            edge={edge}
            isActive={
              isActiveStatus(edge.fromNode.status) ||
              isActiveStatus(edge.toNode.status)
            }
          />
        ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <JobNode
            key={node.id}
            node={node}
            isSelected={selectedJobId === node.id}
            isHovered={hoveredId === node.id}
            onHover={setHoveredId}
            onClick={() => {
              const job = jobs.find((j) => j.id === node.id);
              if (job) onSelectJob(job);
            }}
          />
        ))}
      </svg>
    </div>
  );
}

/** Single job node in the graph */
function JobNode({
  node,
  isSelected,
  isHovered,
  onHover,
  onClick,
}: {
  node: GraphNode;
  isSelected: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const fill = getStatusFill(node.status);
  const icon = getStatusIcon(node.status);
  const isRunning = isActiveStatus(node.status);
  const duration = formatDurationBetween(node.started_at, node.stopped_at);
  const isApproval = node.type === 'approval';

  return (
    <g
      className={`cursor-pointer ${isRunning ? 'node-running' : ''}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
    >
      {/* Selection ring */}
      {(isSelected || isHovered) && (
        <circle
          cx={node.x}
          cy={node.y}
          r={NODE_RADIUS + 5}
          fill="none"
          stroke={isSelected ? '#3384ff' : '#475569'}
          strokeWidth={2}
          opacity={0.8}
        />
      )}

      {/* Node shape */}
      {isApproval ? (
        // Approval nodes are octagonal (using a rounded square rotated 45deg)
        <rect
          x={node.x - NODE_RADIUS * 0.75}
          y={node.y - NODE_RADIUS * 0.75}
          width={NODE_RADIUS * 1.5}
          height={NODE_RADIUS * 1.5}
          rx={4}
          fill={fill}
          transform={`rotate(45 ${node.x} ${node.y})`}
          opacity={0.9}
        />
      ) : (
        <circle
          cx={node.x}
          cy={node.y}
          r={NODE_RADIUS}
          fill={fill}
          opacity={0.9}
        />
      )}

      {/* Status icon */}
      <text
        x={node.x}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="14"
        fontWeight="bold"
        className="pointer-events-none select-none"
      >
        {icon}
      </text>

      {/* Job name label */}
      <text
        x={node.x}
        y={node.y + NODE_RADIUS + 16}
        textAnchor="middle"
        fill={isSelected ? '#e2e8f0' : '#94a3b8'}
        fontSize="12"
        className="pointer-events-none select-none"
      >
        {truncateLabel(node.name, 18)}
      </text>

      {/* Duration label */}
      {node.started_at && (
        <text
          x={node.x}
          y={node.y + NODE_RADIUS + 30}
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
          className="pointer-events-none select-none"
        >
          {duration}
        </text>
      )}

      {/* Tooltip on hover */}
      {isHovered && (
        <g>
          <rect
            x={node.x - 70}
            y={node.y - NODE_RADIUS - 38}
            width={140}
            height={26}
            rx={6}
            fill="#1e293b"
            stroke="#334155"
            strokeWidth={1}
          />
          <text
            x={node.x}
            y={node.y - NODE_RADIUS - 22}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize="11"
            className="pointer-events-none select-none"
          >
            {node.name}
          </text>
        </g>
      )}
    </g>
  );
}

/** Edge between two nodes */
function Edge({ edge, isActive }: { edge: GraphEdge; isActive: boolean }) {
  const path = bezierPath(edge.fromNode, edge.toNode);
  return (
    <path
      d={path}
      fill="none"
      stroke={isActive ? '#38bdf8' : '#334155'}
      strokeWidth={2}
      className={isActive ? 'edge-animated' : ''}
      opacity={0.7}
    />
  );
}

/** Build graph layout from jobs */
function layoutGraph(jobs: Job[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
} {
  if (jobs.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  // Calculate depth for each job (longest path from a root node)
  const depths = new Map<string, number>();
  function getDepth(jobId: string, visited: Set<string> = new Set()): number {
    if (depths.has(jobId)) return depths.get(jobId)!;
    if (visited.has(jobId)) return 0; // cycle protection
    visited.add(jobId);

    const job = jobMap.get(jobId);
    if (!job || !job.dependencies || job.dependencies.length === 0) {
      depths.set(jobId, 0);
      return 0;
    }

    let maxParent = 0;
    for (const depId of job.dependencies) {
      if (jobMap.has(depId)) {
        maxParent = Math.max(maxParent, getDepth(depId, visited) + 1);
      }
    }
    depths.set(jobId, maxParent);
    return maxParent;
  }

  for (const job of jobs) {
    getDepth(job.id);
  }

  // Group jobs by depth
  const columns = new Map<number, Job[]>();
  for (const job of jobs) {
    const depth = depths.get(job.id) ?? 0;
    if (!columns.has(depth)) columns.set(depth, []);
    columns.get(depth)!.push(job);
  }

  // Sort jobs within each column alphabetically for stable layout
  for (const [, colJobs] of columns) {
    colJobs.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Create graph nodes with positions
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();
  let maxCol = 0;
  let maxRowInAnyCol = 0;

  for (const [depth, colJobs] of columns) {
    maxCol = Math.max(maxCol, depth);
    maxRowInAnyCol = Math.max(maxRowInAnyCol, colJobs.length - 1);
    for (let row = 0; row < colJobs.length; row++) {
      const job = colJobs[row];
      const gn: GraphNode = {
        id: job.id,
        name: job.name,
        status: job.status,
        type: job.type,
        depth,
        row,
        x: PADDING_X + depth * COL_SPACING,
        y: PADDING_Y + row * ROW_SPACING,
        dependencies: job.dependencies,
        started_at: job.started_at ?? undefined,
        stopped_at: job.stopped_at ?? undefined,
        job_number: job.job_number ?? undefined,
      };
      nodes.push(gn);
      nodeMap.set(gn.id, gn);
    }
  }

  // Build edges
  const edges: GraphEdge[] = [];
  for (const node of nodes) {
    for (const depId of node.dependencies) {
      const fromNode = nodeMap.get(depId);
      if (fromNode) {
        edges.push({
          from: depId,
          to: node.id,
          fromNode,
          toNode: node,
        });
      }
    }
  }

  const width = PADDING_X * 2 + maxCol * COL_SPACING + NODE_RADIUS * 2;
  const height = PADDING_Y * 2 + maxRowInAnyCol * ROW_SPACING + 40; // extra space for labels

  return { nodes, edges, width: Math.max(width, 200), height: Math.max(height, 140) };
}

/** Create a smooth bezier path between two nodes */
function bezierPath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x + NODE_RADIUS;
  const y1 = from.y;
  const x2 = to.x - NODE_RADIUS;
  const y2 = to.y;
  const cpOffset = Math.abs(x2 - x1) * 0.4;

  return `M ${x1} ${y1} C ${x1 + cpOffset} ${y1}, ${x2 - cpOffset} ${y2}, ${x2} ${y2}`;
}

function truncateLabel(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '\u2026';
}
