import type {
  PaginatedResponse,
  Pipeline,
  Workflow,
  Job,
  JobDetail,
  TestResult,
  Artifact,
  BuildDetailV1,
  LogOutput,
  User,
  Project,
  WorkflowMetrics,
  WorkflowRun,
  FlakyTestsResponse,
  TestMetricsResponse,
  JobMetrics,
} from '../types/circleci';

/**
 * Detect whether we're running in Vite dev mode (proxy available)
 * or a static production build (call CircleCI directly).
 */
const IS_DEV = import.meta.env.DEV;
const DEFAULT_BASE_V2 = IS_DEV ? '/api/circleci' : 'https://circleci.com/api/v2';
const DEFAULT_BASE_V1 = IS_DEV ? '/api/circleci-v1' : 'https://circleci.com/api/v1.1';

export class CircleCIClient {
  private token: string;
  private baseUrl: string;
  private baseUrlV1: string;

  constructor(token: string, baseUrl = DEFAULT_BASE_V2, baseUrlV1 = DEFAULT_BASE_V1) {
    this.token = token;
    this.baseUrl = baseUrl;
    this.baseUrlV1 = baseUrlV1;
  }

  private buildUrl(path: string, base?: string): URL {
    const prefix = base ?? this.baseUrl;
    // If the base is an absolute URL (https://...), use it directly
    if (prefix.startsWith('http')) {
      return new URL(`${prefix}${path}`);
    }
    return new URL(`${prefix}${path}`, window.location.origin);
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
    base?: string,
  ): Promise<T> {
    const url = this.buildUrl(path, base);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v) url.searchParams.set(k, v);
      });
    }

    const res = await fetch(url.toString(), {
      headers: { 'Circle-Token': this.token },
    });

    if (res.status === 401) {
      throw new Error('Invalid API token. Please check your CircleCI personal API token.');
    }
    if (res.status === 404) {
      throw new Error('Not found. Please check the project slug (e.g., gh/org/repo).');
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`CircleCI API error ${res.status}: ${body || res.statusText}`);
    }

    return res.json();
  }

  private async post<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = this.buildUrl(path);
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Circle-Token': this.token,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CircleCI API error ${res.status}: ${text || res.statusText}`);
    }

    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return res.json();
    }
    return {} as T;
  }

  /** Validate token by fetching current user */
  async getMe(): Promise<User> {
    return this.request<User>('/me');
  }

  /** Get project info */
  async getProject(projectSlug: string): Promise<Project> {
    return this.request<Project>(`/project/${projectSlug}`);
  }

  /** List pipelines for a project, optionally filtered by branch */
  async getPipelines(
    projectSlug: string,
    branch?: string,
    pageToken?: string,
  ): Promise<PaginatedResponse<Pipeline>> {
    return this.request<PaginatedResponse<Pipeline>>(
      `/project/${projectSlug}/pipeline`,
      {
        ...(branch ? { branch } : {}),
        ...(pageToken ? { 'page-token': pageToken } : {}),
      },
    );
  }

  /** Get all workflows for a pipeline */
  async getWorkflows(pipelineId: string): Promise<PaginatedResponse<Workflow>> {
    return this.request<PaginatedResponse<Workflow>>(
      `/pipeline/${pipelineId}/workflow`,
    );
  }

  /** Get all jobs for a workflow */
  async getJobs(workflowId: string): Promise<PaginatedResponse<Job>> {
    return this.request<PaginatedResponse<Job>>(
      `/workflow/${workflowId}/job`,
    );
  }

  /** Get detailed info for a single job */
  async getJobDetail(
    projectSlug: string,
    jobNumber: number,
  ): Promise<JobDetail> {
    return this.request<JobDetail>(
      `/project/${projectSlug}/job/${jobNumber}`,
    );
  }

  /** Get test results for a job */
  async getJobTests(
    projectSlug: string,
    jobNumber: number,
  ): Promise<PaginatedResponse<TestResult>> {
    return this.request<PaginatedResponse<TestResult>>(
      `/project/${projectSlug}/${jobNumber}/tests`,
    );
  }

  /** Get artifacts for a job */
  async getJobArtifacts(
    projectSlug: string,
    jobNumber: number,
  ): Promise<PaginatedResponse<Artifact>> {
    return this.request<PaginatedResponse<Artifact>>(
      `/project/${projectSlug}/${jobNumber}/artifacts`,
    );
  }

  /**
   * Get build details from v1.1 API (includes steps with log output URLs).
   * Tries multiple VCS slug formats since v1.1 and v2 use different prefixes.
   */
  async getBuildSteps(
    projectSlug: string,
    buildNum: number,
  ): Promise<BuildDetailV1> {
    const slugVariants = v1SlugVariants(projectSlug);
    let lastError: Error | null = null;

    for (const slug of slugVariants) {
      try {
        return await this.requestRaw<BuildDetailV1>(
          `/project/${slug}/${buildNum}`,
          this.baseUrlV1,
        );
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Try next variant
      }
    }

    throw lastError ?? new Error('Failed to fetch build steps');
  }

  /** Raw request that doesn't throw on 404 for specific callers */
  private async requestRaw<T>(path: string, base: string): Promise<T> {
    const url = this.buildUrl(path, base);
    const res = await fetch(url.toString(), {
      headers: { 'Circle-Token': this.token },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }

  /** Get workflow summary metrics from Insights API */
  async getWorkflowInsights(
    projectSlug: string,
    reportingWindow = 'last-30-days',
    branch?: string,
  ): Promise<PaginatedResponse<WorkflowMetrics>> {
    return this.request<PaginatedResponse<WorkflowMetrics>>(
      `/insights/${projectSlug}/workflows`,
      {
        'reporting-window': reportingWindow,
        'all-branches': branch ? '' : 'true',
        ...(branch ? { branch } : {}),
      },
    );
  }

  /** Get individual workflow runs for trend data */
  async getWorkflowRuns(
    projectSlug: string,
    workflowName: string,
    branch?: string,
  ): Promise<PaginatedResponse<WorkflowRun>> {
    return this.request<PaginatedResponse<WorkflowRun>>(
      `/insights/${projectSlug}/workflows/${encodeURIComponent(workflowName)}`,
      {
        'all-branches': branch ? '' : 'true',
        ...(branch ? { branch } : {}),
      },
    );
  }

  /** Get flaky tests for a project */
  async getFlakyTests(projectSlug: string): Promise<FlakyTestsResponse> {
    return this.request<FlakyTestsResponse>(
      `/insights/${projectSlug}/flaky-tests`,
    );
  }

  /** Get test metrics for a workflow */
  async getTestMetrics(
    projectSlug: string,
    workflowName: string,
  ): Promise<TestMetricsResponse> {
    return this.request<TestMetricsResponse>(
      `/insights/${projectSlug}/workflows/${encodeURIComponent(workflowName)}/test-metrics`,
    );
  }

  /** Get job metrics within a workflow */
  async getJobInsights(
    projectSlug: string,
    workflowName: string,
    reportingWindow = 'last-30-days',
  ): Promise<PaginatedResponse<JobMetrics>> {
    return this.request<PaginatedResponse<JobMetrics>>(
      `/insights/${projectSlug}/workflows/${encodeURIComponent(workflowName)}/jobs`,
      { 'reporting-window': reportingWindow },
    );
  }

  // --- Action Endpoints ---

  /** Rerun a workflow (all jobs or from failed) */
  async rerunWorkflow(
    workflowId: string,
    options?: { fromFailed?: boolean; enableSsh?: boolean },
  ): Promise<{ workflow_id: string }> {
    return this.post<{ workflow_id: string }>(
      `/workflow/${workflowId}/rerun`,
      {
        from_failed: options?.fromFailed ?? false,
        enable_ssh: options?.enableSsh ?? false,
      },
    );
  }

  /** Cancel a running workflow */
  async cancelWorkflow(workflowId: string): Promise<void> {
    await this.post(`/workflow/${workflowId}/cancel`);
  }

  /** Approve a hold/approval job in a workflow */
  async approveJob(
    workflowId: string,
    approvalRequestId: string,
  ): Promise<void> {
    await this.post(
      `/workflow/${workflowId}/approve/${approvalRequestId}`,
    );
  }

  /** Cancel a single running job */
  async cancelJob(
    projectSlug: string,
    jobNumber: number,
  ): Promise<void> {
    await this.post(`/project/${projectSlug}/job/${jobNumber}/cancel`);
  }

  /**
   * Fetch log output from a step action's output_url.
   * In dev mode, uses the Vite server proxy to avoid CORS.
   * In production (static hosting), attempts a direct fetch.
   */
  async getStepLog(outputUrl: string): Promise<LogOutput[]> {
    if (IS_DEV) {
      // Use server-side proxy in dev (avoids CORS)
      const proxyUrl = `/api/step-log?url=${encodeURIComponent(outputUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
      return res.json();
    }

    // Production: try direct fetch (may fail due to CORS on S3 URLs)
    try {
      const res = await fetch(outputUrl);
      if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
      return res.json();
    } catch {
      throw new Error(
        'Step logs are unavailable in static hosting mode due to CORS restrictions. ' +
        'View logs directly in CircleCI.',
      );
    }
  }
}

/**
 * Generate v1.1 API slug variants to try.
 * v2 uses short prefixes (gh, bb), v1.1 uses full names (github, bitbucket).
 * We try the original slug first, then alternate mappings.
 */
const VCS_MAP: Record<string, string> = {
  gh: 'github',
  github: 'gh',
  bb: 'bitbucket',
  bitbucket: 'bb',
};

function v1SlugVariants(slug: string): string[] {
  const parts = slug.split('/');
  if (parts.length < 3) return [slug];

  const [vcs, ...rest] = parts;
  const alt = VCS_MAP[vcs];
  if (alt) {
    return [slug, [alt, ...rest].join('/')];
  }
  return [slug];
}
