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
  async function diagnoseDatabaseTlsTask(_ctx: TaskContext, readingId?: unknown) {
    const { diagnoseDatabaseTls } = await import('./tlsDiagnostic');
    return diagnoseDatabaseTls(Number.isInteger(readingId) ? Number(readingId) : undefined);
  },
);

export const recoverYearlyTransitTask = task(
  { name: 'recoverYearlyTransit', timeoutSeconds: 1800, plan: 'starter' },
  async function recoverYearlyTransitTask(_ctx: TaskContext, job: unknown, retryReportId: unknown) {
    if (typeof retryReportId !== 'string' || !/^[0-9a-f-]{36}$/i.test(retryReportId)) {
      throw new Error('Invalid Yearly transit recovery correlation');
    }
    const { claimRetry } = await import('../src/lib/billing/reportPurchaseStore');
    const typedJob = job as import('./yearlyTransitTask').YearlyTransitJob;
    const claim = await claimRetry(typedJob.readingId, typedJob.userId, retryReportId);
    if (!claim.claimed) throw new Error('Yearly transit reading is not retryable');
    const { runYearlyTransitTask } = await import('./yearlyTransitTask');
    return runYearlyTransitTask({ ...typedJob, reportId: claim.reportId });
  },
);
