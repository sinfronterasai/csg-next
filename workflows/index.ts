import { task, type TaskContext } from '@renderinc/sdk/workflows';

type YearlyTransitJob = {
  readingId: number;
  reportId: string;
  userId: number;
  fromDate?: string;
  birthData: {
    firstName?: string;
    dob: string;
    birthTime: string;
    place: string;
    lat: number;
    lon: number;
    tz: string;
    solarFallback: boolean;
  };
};

export const compileYearlyTransitTask = task(
  {
    name: 'compileYearlyTransit',
    retry: { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 },
    timeoutSeconds: 1800,
    plan: 'starter',
  },
  async function compileYearlyTransitTask(_ctx: TaskContext, job: YearlyTransitJob) {
    const { runYearlyTransitTask } = await import('./yearlyTransitTask');
    return runYearlyTransitTask(job);
  },
);
