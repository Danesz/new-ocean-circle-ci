export type PipelineState =
  | 'created'
  | 'errored'
  | 'setup-pending'
  | 'setup'
  | 'pending';

export type WorkflowStatus =
  | 'success'
  | 'running'
  | 'not_run'
  | 'failed'
  | 'error'
  | 'failing'
  | 'on_hold'
  | 'canceled'
  | 'unauthorized';

export type JobStatus =
  | 'success'
  | 'running'
  | 'not_run'
  | 'failed'
  | 'retried'
  | 'queued'
  | 'not_running'
  | 'infrastructure_fail'
  | 'timedout'
  | 'on_hold'
  | 'terminated-unknown'
  | 'blocked'
  | 'canceled'
  | 'unauthorized';

export type CIStatus = WorkflowStatus | JobStatus | PipelineState;

export interface PaginatedResponse<T> {
  items: T[];
  next_page_token: string | null;
}

export interface Pipeline {
  id: string;
  number: number;
  state: PipelineState;
  created_at: string;
  updated_at?: string;
  trigger: {
    type: string;
    received_at: string;
    actor: {
      login: string;
      avatar_url: string;
    };
  };
  vcs: {
    branch?: string;
    tag?: string;
    revision: string;
    commit?: {
      subject: string;
      body: string;
    };
    provider_name: string;
    origin_repository_url: string;
    target_repository_url?: string;
  };
  trigger_parameters?: Record<string, unknown>;
  errors: Array<{ type: string; message: string }>;
  project_slug: string;
}

/** Test result from a job run */
export interface TestResult {
  message: string;
  source: string;
  run_time: number;
  file: string;
  result: string;
  name: string;
  classname: string;
}

/** Build artifact from a job */
export interface Artifact {
  path: string;
  node_index: number;
  url: string;
}

/** Step action from v1.1 API */
export interface StepAction {
  name: string;
  type: string;
  status: string;
  start_time?: string;
  end_time?: string;
  step: number;
  index: number;
  has_output: boolean;
  output_url?: string;
  run_time_millis?: number;
}

/** Step from v1.1 API build detail */
export interface BuildStep {
  name: string;
  actions: StepAction[];
}

/** v1.1 API build detail (subset of fields we need) */
export interface BuildDetailV1 {
  steps: BuildStep[];
  build_num: number;
  status: string;
  failed?: boolean;
}

/** Log output entry from a step action's output_url */
export interface LogOutput {
  type: string;
  message: string;
}

export interface Workflow {
  id: string;
  name: string;
  pipeline_id: string;
  pipeline_number: number;
  project_slug: string;
  status: WorkflowStatus;
  created_at: string;
  stopped_at?: string;
  started_by: string;
  tag?: string;
}

export interface Job {
  id: string;
  name: string;
  type: 'build' | 'approval';
  status: JobStatus;
  started_at?: string;
  stopped_at?: string;
  job_number?: number;
  dependencies: string[];
  project_slug: string;
  approved_by?: string;
  canceled_by?: string;
  approval_request_id?: string;
}

export interface JobDetail {
  web_url: string;
  name: string;
  status: JobStatus;
  number: number;
  started_at?: string;
  stopped_at?: string;
  duration?: number;
  created_at: string;
  queued_at?: string;
  parallelism: number;
  executor: {
    type: string;
    resource_class: string;
  };
  messages: Array<{ type: string; message: string }>;
  contexts: Array<{ name: string }>;
  organization: { name: string };
  pipeline: { id: string };
  project: { slug: string; name: string; external_url: string };
  latest_workflow: { id: string; name: string };
}

export interface User {
  id: string;
  login: string;
  name: string;
  avatar_url?: string;
}

export interface Project {
  slug: string;
  name: string;
  organization_name: string;
  vcs_info: {
    vcs_url: string;
    provider: string;
    default_branch: string;
  };
}

/** Represents a branch derived from pipeline data */
export interface BranchSummary {
  name: string;
  latestPipeline: Pipeline;
  latestWorkflowStatus?: WorkflowStatus;
}

/** Graph layout types */
export interface GraphNode {
  id: string;
  name: string;
  status: JobStatus;
  type: 'build' | 'approval';
  depth: number;
  row: number;
  x: number;
  y: number;
  dependencies: string[];
  started_at?: string;
  stopped_at?: string;
  job_number?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  fromNode: GraphNode;
  toNode: GraphNode;
}

/** Insights: Workflow summary metrics from GET /insights/{slug}/workflows */
export interface WorkflowMetrics {
  name: string;
  metrics: {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    throughput: number;
    mttr: number;
    total_credits_used: number;
    duration_metrics: {
      min: number;
      max: number;
      mean: number;
      median: number;
      p95: number;
      standard_deviation: number;
    };
  };
  window_start: string;
  window_end: string;
}

/** Insights: Individual workflow run from GET /insights/{slug}/workflows/{name} */
export interface WorkflowRun {
  id: string;
  duration: number;
  status: WorkflowStatus;
  created_at: string;
  stopped_at: string;
  credits_used: number;
  branch: string;
  is_approval: boolean;
}

/** Insights: Flaky test from GET /insights/{slug}/flaky-tests */
export interface FlakyTest {
  workflow_name: string;
  test_name: string;
  job_name: string;
  times_flaked: number;
  classname: string;
  source: string;
  file: string;
  time_wasted: number;
}

/** Insights: Flaky tests response */
export interface FlakyTestsResponse {
  flaky_tests: FlakyTest[];
  total_flaky_tests: number;
}

/** Insights: Test metric item from GET /insights/{slug}/workflows/{name}/test-metrics */
export interface TestMetricItem {
  test_name: string;
  classname: string;
  file: string;
  flaky: boolean;
  total_runs: number;
  failed_runs: number;
  p95_duration: number;
}

/** Insights: Test metrics response */
export interface TestMetricsResponse {
  most_failed_tests: TestMetricItem[];
  slowest_tests: TestMetricItem[];
}

/** Insights: Job metrics from GET /insights/{slug}/workflows/{name}/jobs */
export interface JobMetrics {
  name: string;
  metrics: {
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    throughput: number;
    total_credits_used: number;
    duration_metrics: {
      min: number;
      max: number;
      mean: number;
      median: number;
      p95: number;
      standard_deviation: number;
    };
  };
  window_start: string;
  window_end: string;
}
