import { useMemo, useState } from 'react';
import dagre from 'dagre';
import type { Job, GraphNode, GraphEdge } from '../types/circleci';
import { getStatusFill, getStatusIcon, isActiveStatus } from './StatusBadge';
import { formatDurationBetween } from '../utils/format';

const NODE_WIDTH = 150;
const NODE_HEIGHT = 52;
const PADDING_X = 40;
const PADDING_Y = 25;

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

  // Calculate highlighted path (all ancestors of hovered node)
  const highlightedPath = useMemo(() => {
    if (!hoveredId) return { nodes: new Set<string>(), edges: new Set<string>() };

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const highlightedNodes = new Set<string>();
    const highlightedEdges = new Set<string>();

    // Recursively find all ancestors
    function addAncestors(nodeId: string) {
      if (highlightedNodes.has(nodeId)) return;
      highlightedNodes.add(nodeId);

      const node = nodeMap.get(nodeId);
      if (!node) return;

      for (const depId of node.dependencies) {
        highlightedEdges.add(`${depId}-${nodeId}`);
        addAncestors(depId);
      }
    }

    addAncestors(hoveredId);

    return { nodes: highlightedNodes, edges: highlightedEdges };
  }, [hoveredId, nodes]);

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        No jobs found
      </div>
    );
  }

  const hasHighlight = hoveredId !== null;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="max-w-full"
        style={{ minWidth: Math.min(width, 400) }}
      >
        {/* Edges first (behind nodes) */}
        {edges.map((edge) => {
          const edgeKey = `${edge.from}-${edge.to}`;
          const isHighlighted = highlightedPath.edges.has(edgeKey);
          return (
            <Edge
              key={edgeKey}
              edge={edge}
              isActive={
                isActiveStatus(edge.fromNode.status) ||
                isActiveStatus(edge.toNode.status)
              }
              isHighlighted={isHighlighted}
              isDimmed={hasHighlight && !isHighlighted}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHighlighted = highlightedPath.nodes.has(node.id);
          return (
            <JobNode
              key={node.id}
              node={node}
              isSelected={selectedJobId === node.id}
              isHovered={hoveredId === node.id}
              isHighlighted={isHighlighted}
              isDimmed={hasHighlight && !isHighlighted}
              onHover={setHoveredId}
              onClick={() => {
                const job = jobs.find((j) => j.id === node.id);
                if (job) onSelectJob(job);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Single job node as a card */
function JobNode({
  node,
  isSelected,
  isHovered,
  isHighlighted,
  isDimmed,
  onHover,
  onClick,
}: {
  node: GraphNode;
  isSelected: boolean;
  isHovered: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
  onHover: (id: string | null) => void;
  onClick: () => void;
}) {
  const statusColor = getStatusFill(node.status);
  const icon = getStatusIcon(node.status);
  const isRunning = isActiveStatus(node.status);
  const duration = formatDurationBetween(node.started_at, node.stopped_at);

  const boxX = node.x - NODE_WIDTH / 2;
  const boxY = node.y - NODE_HEIGHT / 2;

  // Determine styling based on highlight state
  const opacity = isDimmed ? 0.3 : 1;
  const strokeColor = isSelected
    ? '#3b82f6'
    : isHighlighted
    ? '#38bdf8'
    : isHovered
    ? '#475569'
    : '#334155';
  const fillColor = isSelected
    ? '#1e3a5f'
    : isHighlighted
    ? '#0c4a6e'
    : isHovered
    ? '#1e293b'
    : '#0f172a';

  return (
    <g
      className={`cursor-pointer ${isRunning ? 'node-running' : ''}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onClick}
      opacity={opacity}
      style={{ transition: 'opacity 0.15s ease' }}
    >
      {/* Card background */}
      <rect
        x={boxX}
        y={boxY}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={6}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={isSelected || isHighlighted ? 2 : 1}
      />

      {/* Status indicator bar on left */}
      <rect
        x={boxX}
        y={boxY}
        width={4}
        height={NODE_HEIGHT}
        rx={2}
        fill={statusColor}
      />

      {/* Status icon circle */}
      <circle
        cx={boxX + 22}
        cy={node.y}
        r={14}
        fill={statusColor}
        opacity={0.9}
      />
      <text
        x={boxX + 22}
        y={node.y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="11"
        fontWeight="bold"
        className="pointer-events-none select-none"
      >
        {icon}
      </text>

      {/* Job name */}
      <text
        x={boxX + 44}
        y={node.y - 7}
        fill="#e2e8f0"
        fontSize="11"
        fontWeight="500"
        className="pointer-events-none select-none"
      >
        {truncateLabel(node.name, 14)}
      </text>

      {/* Duration */}
      <text
        x={boxX + 44}
        y={node.y + 9}
        fill="#64748b"
        fontSize="10"
        className="pointer-events-none select-none"
      >
        {duration || node.status}
      </text>
    </g>
  );
}

/** Edge with orthogonal routing */
function Edge({
  edge,
  isActive,
  isHighlighted,
  isDimmed,
}: {
  edge: GraphEdge;
  isActive: boolean;
  isHighlighted: boolean;
  isDimmed: boolean;
}) {
  const path = orthogonalPath(edge.fromNode, edge.toNode);

  const strokeColor = isHighlighted ? '#38bdf8' : isActive ? '#38bdf8' : '#475569';
  const strokeWidth = isHighlighted ? 3 : 2;
  const opacity = isDimmed ? 0.15 : isHighlighted ? 1 : isActive ? 0.8 : 0.4;

  return (
    <path
      d={path}
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      className={isActive && !isDimmed ? 'edge-animated' : ''}
      opacity={opacity}
      style={{ transition: 'opacity 0.15s ease' }}
    />
  );
}

/** Build graph layout using dagre with dynamic spacing */
function layoutGraph(jobs: Job[]): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
} {
  if (jobs.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  // First pass: calculate number of ranks (dependency levels)
  const depths = new Map<string, number>();
  function getDepth(jobId: string, visited: Set<string> = new Set()): number {
    if (depths.has(jobId)) return depths.get(jobId)!;
    if (visited.has(jobId)) return 0;
    visited.add(jobId);

    const job = jobMap.get(jobId);
    if (!job || job.dependencies.length === 0) {
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

  const numRanks = Math.max(...depths.values()) + 1;

  // Dynamic ranksep: aim for ~1000px total width, but clamp between 100-300px per gap
  const targetWidth = 1000;
  const gaps = Math.max(numRanks - 1, 1);
  const dynamicRanksep = Math.min(300, Math.max(100, (targetWidth - NODE_WIDTH) / gaps));

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 14,
    ranksep: dynamicRanksep,
    marginx: PADDING_X,
    marginy: PADDING_Y,
    ranker: 'longest-path',
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const job of jobs) {
    g.setNode(job.id, {
      label: job.name,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  for (const job of jobs) {
    for (const depId of job.dependencies) {
      if (jobMap.has(depId)) {
        g.setEdge(depId, job.id);
      }
    }
  }

  dagre.layout(g);

  // Extract nodes with initial positions
  const nodes: GraphNode[] = [];
  const nodeMap = new Map<string, GraphNode>();

  for (const nodeId of g.nodes()) {
    const dagreNode = g.node(nodeId);
    const job = jobMap.get(nodeId);
    if (!job || !dagreNode) continue;

    const gn: GraphNode = {
      id: job.id,
      name: job.name,
      status: job.status,
      type: job.type,
      depth: 0,
      row: 0,
      x: dagreNode.x,
      y: dagreNode.y,
      dependencies: job.dependencies,
      started_at: job.started_at ?? undefined,
      stopped_at: job.stopped_at ?? undefined,
      job_number: job.job_number ?? undefined,
    };
    nodes.push(gn);
    nodeMap.set(gn.id, gn);
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

  // Calculate graph height first
  const graphData = g.graph();
  const height = Math.max((graphData.height ?? 140) + PADDING_Y * 2, 140);

  // Get final dimensions from dagre
  const width = Math.max((graphData.width ?? 200) + PADDING_X * 2, 400);
  return { nodes, edges, width, height };
}

/** Create orthogonal (right-angle) path between nodes */
function orthogonalPath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y;
  const x2 = to.x - NODE_WIDTH / 2;
  const y2 = to.y;

  // Midpoint for the vertical segment
  const midX = x1 + (x2 - x1) / 2;

  // Create path: horizontal -> vertical -> horizontal
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}

function truncateLabel(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '\u2026';
}
