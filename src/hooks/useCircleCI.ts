import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  Pipeline,
  Workflow,
  Job,
  JobDetail,
  TestResult,
  Artifact,
  BuildDetailV1,
  BranchSummary,
  WorkflowStatus,
  WorkflowMetrics,
  WorkflowRun,
  FlakyTestsResponse,
  TestMetricsResponse,
  JobMetrics,
} from '../types/circleci';
import { isActiveStatus } from '../components/StatusBadge';

const POLL_INTERVAL = 10_000; // 10 seconds

/** Generic async data hook */
function useAsyncData<T>(
  fetcher: (() => Promise<T>) | null,
  deps: unknown[],
  pollWhenActive = false,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    if (!fetcher) return;
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    load();

    if (pollWhenActive) {
      intervalRef.current = setInterval(load, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  return { data, loading, error, refetch };
}

export interface BranchesResult {
  branches: BranchSummary[];
  triggeredCount: number;
}

/** Fetch branches (derived from recent pipelines), excluding branchless pipelines */
export function useBranches() {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<BranchesResult> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');

    const { items: pipelines } = await client.getPipelines(projectSlug);

    // Separate branch pipelines from branchless (triggered) pipelines
    const branchMap = new Map<string, Pipeline>();
    let triggeredCount = 0;

    for (const p of pipelines) {
      if (!p.vcs.branch) {
        triggeredCount++;
        continue;
      }
      if (!branchMap.has(p.vcs.branch)) {
        branchMap.set(p.vcs.branch, p);
      }
    }

    // Fetch workflow status for each branch's latest pipeline
    const branches: BranchSummary[] = [];
    const entries = Array.from(branchMap.entries());

    // Fetch workflows in parallel (max 6 at a time to be kind to rate limits)
    const batchSize = 6;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async ([name, pipeline]) => {
          try {
            const { items: workflows } = await client.getWorkflows(pipeline.id);
            const worstStatus = aggregateWorkflowStatus(workflows);
            return { name, latestPipeline: pipeline, latestWorkflowStatus: worstStatus };
          } catch {
            return { name, latestPipeline: pipeline };
          }
        }),
      );
      branches.push(...results);
    }

    // Sort: active statuses first, then by date
    branches.sort((a, b) => {
      const aActive = a.latestWorkflowStatus && isActiveStatus(a.latestWorkflowStatus) ? 0 : 1;
      const bActive = b.latestWorkflowStatus && isActiveStatus(b.latestWorkflowStatus) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return new Date(b.latestPipeline.created_at).getTime() - new Date(a.latestPipeline.created_at).getTime();
    });

    return { branches, triggeredCount };
  }, [client, projectSlug]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug], true);
}

/** A triggered pipeline with its resolved workflow status */
export interface TriggeredPipeline {
  pipeline: Pipeline;
  workflowStatus?: WorkflowStatus;
  triggerLabel: string;
}

/** Fetch pipelines that have no branch (API triggers, schedules, tags, etc.) */
export function useTriggeredPipelines() {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<TriggeredPipeline[]> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');

    const { items: pipelines } = await client.getPipelines(projectSlug);

    // Keep only branchless pipelines
    const branchless = pipelines.filter((p) => !p.vcs.branch);

    // Fetch workflow statuses in parallel
    const results: TriggeredPipeline[] = [];
    const batchSize = 6;
    for (let i = 0; i < branchless.length; i += batchSize) {
      const batch = branchless.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (pipeline) => {
          let workflowStatus: WorkflowStatus | undefined;
          try {
            const { items: workflows } = await client.getWorkflows(pipeline.id);
            workflowStatus = aggregateWorkflowStatus(workflows);
          } catch {
            // ignore
          }
          const triggerLabel = deriveTriggerLabel(pipeline);
          return { pipeline, workflowStatus, triggerLabel };
        }),
      );
      results.push(...batchResults);
    }

    return results;
  }, [client, projectSlug]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug], true);
}

/** Derive a human-readable trigger label from a pipeline */
function deriveTriggerLabel(pipeline: Pipeline): string {
  if (pipeline.vcs.tag) return `tag: ${pipeline.vcs.tag}`;
  switch (pipeline.trigger.type) {
    case 'schedule':
    case 'scheduled_pipeline':
      return 'Scheduled';
    case 'api':
      return 'API';
    case 'webhook':
      return 'Webhook';
    default:
      return pipeline.trigger.type || 'Trigger';
  }
}

/** Fetch pipelines for a specific branch */
export function usePipelines(branch: string) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<Pipeline[]> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');
    const { items } = await client.getPipelines(projectSlug, branch);
    return items;
  }, [client, projectSlug, branch]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug, branch], true);
}

/** Fetch workflows for a pipeline */
export function useWorkflows(pipelineId: string) {
  const { client } = useAuth();

  const fetcher = useCallback(async (): Promise<Workflow[]> => {
    if (!client) throw new Error('Not authenticated');
    const { items } = await client.getWorkflows(pipelineId);
    return items;
  }, [client, pipelineId]);

  return useAsyncData(client ? fetcher : null, [client, pipelineId], true);
}

/** Fetch jobs for a workflow */
export function useJobs(workflowId: string) {
  const { client } = useAuth();

  const fetcher = useCallback(async (): Promise<Job[]> => {
    if (!client) throw new Error('Not authenticated');
    const { items } = await client.getJobs(workflowId);
    return items;
  }, [client, workflowId]);

  return useAsyncData(client ? fetcher : null, [client, workflowId], true);
}

/** Fetch detail for a specific job */
export function useJobDetail(jobNumber: number | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<JobDetail> => {
    if (!client || !projectSlug || !jobNumber) throw new Error('Missing params');
    return client.getJobDetail(projectSlug, jobNumber);
  }, [client, projectSlug, jobNumber]);

  return useAsyncData(
    client && projectSlug && jobNumber ? fetcher : null,
    [client, projectSlug, jobNumber],
  );
}

/** Fetch test results for a job */
export function useJobTests(jobNumber: number | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<TestResult[]> => {
    if (!client || !projectSlug || !jobNumber) throw new Error('Missing params');
    const { items } = await client.getJobTests(projectSlug, jobNumber);
    return items;
  }, [client, projectSlug, jobNumber]);

  return useAsyncData(
    client && projectSlug && jobNumber ? fetcher : null,
    [client, projectSlug, jobNumber],
  );
}

/** Fetch artifacts for a job */
export function useJobArtifacts(jobNumber: number | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<Artifact[]> => {
    if (!client || !projectSlug || !jobNumber) throw new Error('Missing params');
    const { items } = await client.getJobArtifacts(projectSlug, jobNumber);
    return items;
  }, [client, projectSlug, jobNumber]);

  return useAsyncData(
    client && projectSlug && jobNumber ? fetcher : null,
    [client, projectSlug, jobNumber],
  );
}

/** Fetch build steps from v1.1 API (includes log output URLs) */
export function useBuildSteps(jobNumber: number | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<BuildDetailV1> => {
    if (!client || !projectSlug || !jobNumber) throw new Error('Missing params');
    return client.getBuildSteps(projectSlug, jobNumber);
  }, [client, projectSlug, jobNumber]);

  return useAsyncData(
    client && projectSlug && jobNumber ? fetcher : null,
    [client, projectSlug, jobNumber],
  );
}

/** Fetch workflow insights (summary metrics) */
export function useWorkflowInsights(reportingWindow = 'last-30-days') {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<WorkflowMetrics[]> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');
    const { items } = await client.getWorkflowInsights(projectSlug, reportingWindow);
    return items;
  }, [client, projectSlug, reportingWindow]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug, reportingWindow]);
}

/** Fetch individual workflow runs for trend chart */
export function useWorkflowRuns(workflowName: string | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<WorkflowRun[]> => {
    if (!client || !projectSlug || !workflowName) throw new Error('Missing params');
    const { items } = await client.getWorkflowRuns(projectSlug, workflowName);
    return items;
  }, [client, projectSlug, workflowName]);

  return useAsyncData(
    client && projectSlug && workflowName ? fetcher : null,
    [client, projectSlug, workflowName],
  );
}

/** Fetch flaky tests */
export function useFlakyTests() {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<FlakyTestsResponse> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');
    return client.getFlakyTests(projectSlug);
  }, [client, projectSlug]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug]);
}

/** Fetch test metrics for a workflow */
export function useTestMetrics(workflowName: string | null) {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<TestMetricsResponse> => {
    if (!client || !projectSlug || !workflowName) throw new Error('Missing params');
    return client.getTestMetrics(projectSlug, workflowName);
  }, [client, projectSlug, workflowName]);

  return useAsyncData(
    client && projectSlug && workflowName ? fetcher : null,
    [client, projectSlug, workflowName],
  );
}

/** Fetch job metrics within a workflow */
export function useJobInsights(workflowName: string | null, reportingWindow = 'last-30-days') {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<JobMetrics[]> => {
    if (!client || !projectSlug || !workflowName) throw new Error('Missing params');
    const { items } = await client.getJobInsights(projectSlug, workflowName, reportingWindow);
    return items;
  }, [client, projectSlug, workflowName, reportingWindow]);

  return useAsyncData(
    client && projectSlug && workflowName ? fetcher : null,
    [client, projectSlug, workflowName, reportingWindow],
  );
}

/** Aggregate workflow statuses to a single "worst" status */
function aggregateWorkflowStatus(
  workflows: Workflow[],
): Workflow['status'] | undefined {
  if (workflows.length === 0) return undefined;

  const priority: Workflow['status'][] = [
    'failed',
    'error',
    'failing',
    'running',
    'on_hold',
    'canceled',
    'not_run',
    'unauthorized',
    'success',
  ];

  for (const status of priority) {
    if (workflows.some((w) => w.status === status)) return status;
  }

  return workflows[0].status;
}
