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
  errors: Array<{ type: string; message: string }>;
  project_slug: string;
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
