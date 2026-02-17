import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkflows, useJobs } from '../hooks/useCircleCI';
import { useAuth } from '../context/AuthContext';
import { PipelineGraph } from '../components/PipelineGraph';
import { TimelineChart } from '../components/TimelineChart';
import { JobPanel } from '../components/JobPanel';
import { StatusBadge, isActiveStatus } from '../components/StatusBadge';
import { ErrorDisplay, Skeleton } from '../components/Layout';
import { formatDurationBetween, formatRelativeTime } from '../utils/format';
import type { Job } from '../types/circleci';

export function WorkflowDetail() {
  const { pipelineId, workflowId } = useParams<{
    pipelineId: string;
    workflowId: string;
  }>();

  const {
    data: workflows,
    loading: wfLoading,
    error: wfError,
  } = useWorkflows(pipelineId!);

  const {
    data: jobs,
    loading: jobsLoading,
    error: jobsError,
    refetch,
  } = useJobs(workflowId!);

  const { client } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSelectJob = useCallback((job: Job) => {
    setSelectedJob((prev) => (prev?.id === job.id ? null : job));
  }, []);

  const workflow = workflows?.find((w) => w.id === workflowId);
  const error = wfError || jobsError;
  const loading = wfLoading || jobsLoading;

  const handleRerun = useCallback(async (fromFailed: boolean) => {
    if (!client || !workflowId) return;
    const label = fromFailed ? 'rerun-failed' : 'rerun';
    setActionLoading(label);
    setActionError(null);
    try {
      await client.rerunWorkflow(workflowId, { fromFailed });
      // Refetch after a short delay to let CircleCI process
      setTimeout(refetch, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rerun failed');
    } finally {
      setActionLoading(null);
    }
  }, [client, workflowId, refetch]);

  const handleCancel = useCallback(async () => {
    if (!client || !workflowId) return;
    setActionLoading('cancel');
    setActionError(null);
    try {
      await client.cancelWorkflow(workflowId);
      setTimeout(refetch, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setActionLoading(null);
    }
  }, [client, workflowId, refetch]);

  const isRunning = workflow && isActiveStatus(workflow.status);
  const isFailed = workflow && (workflow.status === 'failed' || workflow.status === 'error');
  const isTerminal = workflow && !isActiveStatus(workflow.status);

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {/* Workflow header */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <Link
              to={-1 as unknown as string}
              onClick={(e) => {
                e.preventDefault();
                window.history.back();
              }}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path
                  fillRule="evenodd"
                  d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                  clipRule="evenodd"
                />
              </svg>
            </Link>

            {loading ? (
              <Skeleton className="h-6 w-48" />
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-100">
                  {workflow?.name ?? 'Workflow'}
                </h2>
                {workflow && <StatusBadge status={workflow.status} />}
              </>
            )}
          </div>

          {workflow && (
            <div className="flex items-center justify-between ml-8">
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span>
                  Pipeline #{workflow.pipeline_number}
                </span>
                <span>
                  {formatDurationBetween(workflow.created_at, workflow.stopped_at)}
                </span>
                <span>{formatRelativeTime(workflow.created_at)}</span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {isRunning && (
                  <ActionButton
                    label="Cancel"
                    loading={actionLoading === 'cancel'}
                    disabled={!!actionLoading}
                    variant="danger"
                    onClick={handleCancel}
                  />
                )}
                {isFailed && (
                  <ActionButton
                    label="Rerun Failed"
                    loading={actionLoading === 'rerun-failed'}
                    disabled={!!actionLoading}
                    variant="primary"
                    onClick={() => handleRerun(true)}
                  />
                )}
                {isTerminal && (
                  <ActionButton
                    label="Rerun"
                    loading={actionLoading === 'rerun'}
                    disabled={!!actionLoading}
                    variant="default"
                    onClick={() => handleRerun(false)}
                  />
                )}
              </div>
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="ml-8 mt-2 text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded px-3 py-1.5">
              {actionError}
            </div>
          )}
        </div>

        {/* Pipeline graph */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Pipeline
            </h3>
            <button
              onClick={refetch}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Refresh
            </button>
          </div>

          {loading && !jobs ? (
            <div className="bg-slate-900 rounded-lg p-8">
              <div className="flex items-center gap-8 justify-center">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : jobs ? (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
              <PipelineGraph
                jobs={jobs}
                selectedJobId={selectedJob?.id}
                onSelectJob={handleSelectJob}
              />
            </div>
          ) : null}
        </div>

        {/* Timeline chart */}
        {jobs && jobs.length > 0 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
              Timeline
            </h3>
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
              <TimelineChart
                jobs={jobs}
                selectedJobId={selectedJob?.id}
                onSelectJob={handleSelectJob}
              />
            </div>
          </div>
        )}

        {/* Workflow siblings (other workflows in same pipeline) */}
        {workflows && workflows.length > 1 && (
          <div className="px-6 pb-6">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
              Other workflows in this pipeline
            </h3>
            <div className="flex flex-wrap gap-2">
              {workflows
                .filter((w) => w.id !== workflowId)
                .map((w) => (
                  <Link
                    key={w.id}
                    to={`/pipeline/${pipelineId}/workflow/${w.id}`}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-600 transition-colors text-sm"
                  >
                    <StatusBadge status={w.status} />
                    <span className="text-slate-300">{w.name}</span>
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Job detail panel (slides in from right) */}
      {selectedJob && (
        <JobPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onAction={() => setTimeout(refetch, 1500)}
        />
      )}
    </div>
  );
}

/** Small action button with loading state */
function ActionButton({
  label,
  loading,
  disabled,
  variant,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  variant: 'primary' | 'danger' | 'default';
  onClick: () => void;
}) {
  const colors = {
    primary: 'bg-ocean-600 hover:bg-ocean-500 text-white',
    danger: 'bg-red-900/50 hover:bg-red-900/70 text-red-300 border border-red-800/50',
    default: 'bg-slate-800 hover:bg-slate-700 text-slate-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colors[variant]}`}
    >
      {loading ? (
        <span className="flex items-center gap-1.5">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
          </svg>
          {label}...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
