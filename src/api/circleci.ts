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
} from '../types/circleci';

export class CircleCIClient {
  private token: string;
  private baseUrl: string;
  private baseUrlV1: string;

  constructor(token: string, baseUrl = '/api/circleci', baseUrlV1 = '/api/circleci-v1') {
    this.token = token;
    this.baseUrl = baseUrl;
    this.baseUrlV1 = baseUrlV1;
  }

  private async request<T>(
    path: string,
    params?: Record<string, string>,
    base?: string,
  ): Promise<T> {
    const url = new URL(`${base ?? this.baseUrl}${path}`, window.location.origin);
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
    const url = new URL(`${base}${path}`, window.location.origin);
    const res = await fetch(url.toString(), {
      headers: { 'Circle-Token': this.token },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API error ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }

  /** Fetch log output from a step action's output_url via server proxy (avoids CORS) */
  async getStepLog(outputUrl: string): Promise<LogOutput[]> {
    const proxyUrl = `/api/step-log?url=${encodeURIComponent(outputUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
    return res.json();
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
