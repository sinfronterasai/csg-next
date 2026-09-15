import { query } from '../src/lib/db';
import https from 'node:https';
import { computeChart } from '../src/lib/chartEngine';
import { compileYearlyTransit } from '../src/lib/yearlyTransit/compiler';
import { buildDispatchPayload } from '../src/lib/reportPipeline';
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
  try {
    return await runYearlyTransitTaskUnsafe(job);
  } catch (error) {
    await query(
      `UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1 AND pipeline_status IN ('queued', 'processing')`,
      [job.readingId],
    ).catch(() => undefined);
    throw error;
  }
}

async function runYearlyTransitTaskUnsafe(job: YearlyTransitJob) {
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
  const payload = buildDispatchPayload({
    reportId: job.reportId,
    reportType: 'transit',
    tier: 'paid',
    birthData: job.birthData,
    verifiedFacts: pack,
    callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
    promptSlug: '08-yearly-transit',
  });
  const webhookUrl = process.env.N8N_REPORT_WEBHOOK_URL;
  const token = process.env.REPORT_PIPELINE_TOKEN;
  if (!webhookUrl || !token) throw new Error('Yearly transit dispatch configuration is missing');
  const responseStatus = await new Promise<number>((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = https.request(webhookUrl, {
      method: 'POST',
      rejectUnauthorized: true,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Authorization: `Bearer ${token}` },
    }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode ?? 0));
    });
    request.once('error', reject);
    request.end(body);
  });
  if (responseStatus < 200 || responseStatus >= 300) {
    await query(`UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1 AND pipeline_status = 'queued'`, [job.readingId]);
    throw new Error(`Yearly transit dispatch failed with status ${responseStatus}`);
  }
  return { readingId: job.readingId, reportId: job.reportId, status: 'queued' };
}
