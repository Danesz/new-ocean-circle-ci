import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  Pipeline,
  Workflow,
  Job,
  JobDetail,
  BranchSummary,
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

/** Fetch branches (derived from recent pipelines) */
export function useBranches() {
  const { client, projectSlug } = useAuth();

  const fetcher = useCallback(async (): Promise<BranchSummary[]> => {
    if (!client || !projectSlug) throw new Error('Not authenticated');

    const { items: pipelines } = await client.getPipelines(projectSlug);

    // Group by branch, keep only the latest pipeline per branch
    const branchMap = new Map<string, Pipeline>();
    for (const p of pipelines) {
      const branch = p.vcs.branch ?? '(no branch)';
      if (!branchMap.has(branch)) {
        branchMap.set(branch, p);
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

    return branches;
  }, [client, projectSlug]);

  return useAsyncData(client && projectSlug ? fetcher : null, [client, projectSlug], true);
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
