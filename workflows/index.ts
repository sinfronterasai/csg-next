import { task, type TaskContext } from '@renderinc/sdk/workflows';

export const compileYearlyTransitTask = task(
  {
    name: 'compileYearlyTransit',
    retry: { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 },
    timeoutSeconds: 1800,
    plan: 'starter',
  },
  async function compileYearlyTransitTask(_ctx: TaskContext, job: unknown) {
    const { runYearlyTransitTask } = await import('./yearlyTransitTask');
    return runYearlyTransitTask(job as Parameters<typeof runYearlyTransitTask>[0]);
  },
);

export const diagnoseN8nTlsTask = task(
  { name: 'diagnoseN8nTls', timeoutSeconds: 60, plan: 'flex' },
  async function diagnoseN8nTlsTask() {
    const { diagnoseN8nTls } = await import('./tlsDiagnostic');
    return diagnoseN8nTls();
  },
);

export const diagnoseDatabaseTlsTask = task(
  { name: 'diagnoseDatabaseTls', timeoutSeconds: 30, plan: 'flex' },
  async function diagnoseDatabaseTlsTask() {
    const { diagnoseDatabaseTls } = await import('./tlsDiagnostic');
    return diagnoseDatabaseTls();
  },
);
