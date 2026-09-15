import { query } from '../src/lib/db';
import { computeChart } from '../src/lib/chartEngine';
import { compileYearlyTransit } from '../src/lib/yearlyTransit/compiler';
import { dispatchReport } from '../src/lib/reportPipeline';
import { REPORT_META } from '../src/lib/reportEngine';

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

export async function runYearlyTransitTask(job: YearlyTransitJob) {
  const chart = await computeChart({
    name: job.birthData.firstName,
    date: job.birthData.dob,
    time: job.birthData.birthTime,
    location: job.birthData.place,
    latitude: job.birthData.lat,
    longitude: job.birthData.lon,
    timezone: job.birthData.tz,
    unknownTime: job.birthData.solarFallback,
    requireAllBodies: true,
  });
  const generatedAtUtc = new Date().toISOString();
  const pack = await compileYearlyTransit({
    chart,
    snapshot: {
      snapshotId: job.reportId,
      generatedAtUtc,
      birthData: {
        date: job.birthData.dob,
        time: job.birthData.birthTime,
        latitude: job.birthData.lat,
        longitude: job.birthData.lon,
        timezone: job.birthData.tz,
      },
    },
    fromDate: job.fromDate || generatedAtUtc.slice(0, 10),
  });
  const overview = pack.windows
    .filter((window) => pack.aiPacks.primaryWindows.some((item) => item.id === window.id))
    .slice(0, 8)
    .map((window) => ({
      label: `${window.mover} ${window.aspectType} ${window.target}`,
      value: `${window.activeWindow.startUtc} → ${window.activeWindow.endUtc}`,
      note: `Score ${window.importanceScore}/100 · ${window.segments[0]?.direction ?? 'indeterminate'}`,
    }));
  const result = {
    title: REPORT_META.transit.title,
    reportType: 'transit',
    generatedFor: 'self',
    reportId: job.reportId,
    pricePaid: REPORT_META.transit.price,
    tier: 'paid',
    overview,
    verifiedFacts: pack,
    yearlyTransitPack: pack,
    pending: true,
    metadata: { birthData: job.birthData, yearlyTransitPack: pack },
  };
  const updated = await query(
    `UPDATE readings SET result = $1, pipeline_status = 'queued'
       WHERE id = $2 AND pipeline_status IN ('queued', 'processing')`,
    [JSON.stringify(result), job.readingId],
  );
  if ((updated.rowCount ?? 0) !== 1) throw new Error('Yearly transit reading is no longer active');
  const dispatched = await dispatchReport({
    reportId: job.reportId,
    reportType: 'transit',
    tier: 'paid',
    birthData: job.birthData,
    verifiedFacts: pack,
    callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
  });
  if (!dispatched.ok) {
    await query(`UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1 AND pipeline_status = 'queued'`, [job.readingId]);
    throw new Error(`Yearly transit dispatch failed with status ${dispatched.status}`);
  }
  return { readingId: job.readingId, reportId: job.reportId, status: 'queued' };
}
