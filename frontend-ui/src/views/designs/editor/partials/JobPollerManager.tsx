import { useRef, useEffect } from 'react';
import { useGetProcessingJobQuery } from '@/store/designSlice';
import type { JobTracker, JobUpdateFn } from '../hooks/useProcessing';

// -----------------------------------------------------------------
// Polling sub-component (one per active job)
// -----------------------------------------------------------------

const POLL_INTERVAL = 3000;

const JobPollerItem = ({
  jobId,
  onUpdate,
}: {
  jobId: string;
  onUpdate: JobUpdateFn;
}) => {
  const { data } = useGetProcessingJobQuery(jobId, {
    pollingInterval: POLL_INTERVAL,
  });

  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    if (data.status !== prevStatusRef.current) {
      prevStatusRef.current = data.status;
      onUpdate(
        jobId,
        data.status,
        data.result_file ?? undefined,
        data.error_message ?? undefined,
      );
    }
  }, [data, jobId, onUpdate]);

  return null;
};

// -----------------------------------------------------------------
// JobPollerManager — renders invisible pollers for pending/running jobs
// -----------------------------------------------------------------

interface JobPollerManagerProps {
  jobs: JobTracker[];
  onUpdate: JobUpdateFn;
}

export const JobPollerManager = ({ jobs, onUpdate }: JobPollerManagerProps) => {
  const activeJobs = jobs.filter(
    (j) => j.status === 'pending' || j.status === 'running',
  );

  if (activeJobs.length === 0) return null;

  return (
    <>
      {activeJobs.map((j) => (
        <JobPollerItem key={j.jobId} jobId={j.jobId} onUpdate={onUpdate} />
      ))}
    </>
  );
};
