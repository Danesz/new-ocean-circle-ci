import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useWorkflows, useJobs } from '../hooks/useCircleCI';
import { PipelineGraph } from '../components/PipelineGraph';
import { TimelineChart } from '../components/TimelineChart';
import { JobPanel } from '../components/JobPanel';
import { StatusBadge } from '../components/StatusBadge';
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

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleSelectJob = useCallback((job: Job) => {
    setSelectedJob((prev) => (prev?.id === job.id ? null : job));
  }, []);

  const workflow = workflows?.find((w) => w.id === workflowId);
  const error = wfError || jobsError;
  const loading = wfLoading || jobsLoading;

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
            <div className="flex items-center gap-4 text-sm text-slate-500 ml-8">
              <span>
                Pipeline #{workflow.pipeline_number}
              </span>
              <span>
                {formatDurationBetween(workflow.created_at, workflow.stopped_at)}
              </span>
              <span>{formatRelativeTime(workflow.created_at)}</span>
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
        <JobPanel job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}
