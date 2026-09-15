import { Render } from '@renderinc/sdk';

export type YearlyTransitWorkflowInput = {
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

export async function startYearlyTransitWorkflow(input: YearlyTransitWorkflowInput): Promise<{ taskRunId: string }> {
  const taskSlug = process.env.RENDER_YEARLY_TRANSIT_TASK_SLUG;
  if (!taskSlug) throw new Error('RENDER_YEARLY_TRANSIT_TASK_SLUG is not configured');
  const render = new Render({ token: process.env.RENDER_API_KEY });
  const run = await render.workflows.startTask(taskSlug, [input]);
  return { taskRunId: run.taskRunId };
}
