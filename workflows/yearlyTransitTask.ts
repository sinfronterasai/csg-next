import { Client } from 'pg';
import { buildDbPoolConfig, query } from '../src/lib/db';
import https from 'node:https';
import { computeChart } from '../src/lib/chartEngine';
import { compileYearlyTransit } from '../src/lib/yearlyTransit/compiler';
import { buildDispatchPayload } from '../src/lib/reportPipeline';
import { REPORT_META } from '../src/lib/reportEngine';

export type YearlyTransitJob = {
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

export async function resumeYearlyTransitTask(readingId: number, expectedReportId: string) {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration is missing');
  const client = new Client(buildDbPoolConfig(process.env.DATABASE_URL));
  await client.connect();
  let rows: any[];
  try {
    const state = await client.query(
      `SELECT r.user_id, r.pipeline_status, r.result, o.status AS order_status
         FROM readings r JOIN report_orders o ON o.reading_id = r.id
        WHERE r.id = $1`,
      [readingId],
    );
    rows = state.rows;
  } finally {
    await client.end();
  }
  const row = rows[0];
  const result = row?.result as Record<string, any> | undefined;
  const metadata = result?.metadata as Record<string, any> | undefined;
  if (!row || row.order_status !== 'consumed' || !['queued', 'processing'].includes(row.pipeline_status) ||
      result?.reportId !== expectedReportId || !metadata?.birthData) {
    throw new Error('Yearly transit reading cannot be safely resumed');
  }
  return runYearlyTransitTask({
    readingId,
    reportId: expectedReportId,
    userId: Number(row.user_id),
    fromDate: typeof metadata.fromDate === 'string' ? metadata.fromDate : undefined,
    birthData: metadata.birthData as YearlyTransitJob['birthData'],
  });
}

export async function redispatchPersistedYearlyTransit(readingId: number, expectedReportId: string) {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration is missing');
  const client = new Client(buildDbPoolConfig(process.env.DATABASE_URL));
  await client.connect();
  let row: any;
  try {
    const state = await client.query(
      `SELECT r.pipeline_status, r.result, o.status AS order_status
         FROM readings r JOIN report_orders o ON o.reading_id = r.id
        WHERE r.id = $1`,
      [readingId],
    );
    row = state.rows[0];
  } finally {
    await client.end();
  }
  const result = row?.result as Record<string, any> | undefined;
  const metadata = result?.metadata as Record<string, any> | undefined;
  const pack = result?.yearlyTransitPack ?? result?.verifiedFacts ?? metadata?.yearlyTransitPack;
  if (!row || row.order_status !== 'consumed' || !['queued', 'processing'].includes(row.pipeline_status) ||
      result?.reportId !== expectedReportId || !metadata?.birthData ||
      pack?.schemaVersion !== 'csg-yearly-transit-fact-pack-v1') {
    throw new Error('Persisted Yearly transit report cannot be safely redispatched');
  }
  const payload = buildDispatchPayload({
    reportId: expectedReportId,
    reportType: 'transit',
    tier: 'paid',
    birthData: metadata.birthData,
    verifiedFacts: pack,
    callbackUrl: process.env.CSG_REPORT_CALLBACK_URL,
    promptSlug: '08-yearly-transit',
  });
  const responseStatus = await postYearlyPayload(payload);
  if (responseStatus < 200 || responseStatus >= 300) throw new Error(`Yearly transit redispatch failed with status ${responseStatus}`);
  return { readingId, reportId: expectedReportId, status: 'queued', reusedPersistedPack: true };
}

export async function verifyPersistedYearlyDelivery(readingId: number, expectedReportId: string) {
  if (!process.env.DATABASE_URL) throw new Error('Database configuration is missing');
  const client = new Client(buildDbPoolConfig(process.env.DATABASE_URL));
  await client.connect();
  let row: any;
  try {
    const state = await client.query(
      `SELECT r.pipeline_status, r.result, o.status AS order_status
         FROM readings r JOIN report_orders o ON o.reading_id = r.id
        WHERE r.id = $1`,
      [readingId],
    );
    row = state.rows[0];
  } finally {
    await client.end();
  }
  const result = row?.result as Record<string, any> | undefined;
  const metadata = result?.metadata as Record<string, any> | undefined;
  const pack = result?.yearlyTransitPack ?? metadata?.yearlyTransitPack;
  const sections = Array.isArray(result?.pipeline?.sections) ? result.pipeline.sections : [];
  if (!row || row.order_status !== 'consumed' || row.pipeline_status !== 'approved' ||
      result?.reportId !== expectedReportId || pack?.schemaVersion !== 'csg-yearly-transit-fact-pack-v1' || !sections.length) {
    throw new Error('Approved Yearly transit delivery is incomplete');
  }
  const { buildYearlyTransitPdf } = await import('../src/lib/yearlyTransit/pdf');
  const { buildYearlyTransitIcs } = await import('../src/lib/yearlyTransit/ics');
  const pdf = await buildYearlyTransitPdf(
    pack,
    String(result.title || 'Yearly Transit Forecast'),
    String(metadata?.birthData?.firstName || 'Seeker'),
    sections.map((section: any) => ({ heading: String(section.id || 'Section'), body: String(section.prose || '') })),
  );
  const ics = buildYearlyTransitIcs(pack, expectedReportId);
  return {
    readingId,
    reportId: expectedReportId,
    status: row.pipeline_status,
    sectionCount: sections.length,
    pdfBytes: pdf.byteLength,
    pdfMagic: Buffer.from(pdf).subarray(0, 5).toString('ascii'),
    icsBytes: Buffer.byteLength(ics, 'utf8'),
    icsEventCount: (ics.match(/BEGIN:VEVENT/g) || []).length,
    icsValidEnvelope: ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'),
  };
}

export async function verifyAuthenticatedYearlyDelivery(readingId: number, expectedReportId: string) {
  if (!process.env.DATABASE_URL || !process.env.CSG_REPORT_CALLBACK_URL) throw new Error('Delivery verification configuration is missing');
  const callback = new URL(process.env.CSG_REPORT_CALLBACK_URL);
  if (callback.protocol !== 'https:' || callback.hostname !== 'csg-lb-staging-0905.onrender.com') {
    throw new Error('Delivery verification host is not allowlisted');
  }
  const client = new Client(buildDbPoolConfig(process.env.DATABASE_URL));
  await client.connect();
  let row: any;
  const state = await client.query(
    `SELECT r.user_id, r.pipeline_status, r.result->>'reportId' AS report_id, o.status AS order_status,
            u.email, u.password_hash
       FROM readings r JOIN report_orders o ON o.reading_id = r.id JOIN users u ON u.id = r.user_id
      WHERE r.id = $1`,
    [readingId],
  );
  row = state.rows[0];
  if (!row || row.order_status !== 'consumed' || row.pipeline_status !== 'approved' || row.report_id !== expectedReportId) {
    await client.end();
    throw new Error('Approved Yearly transit route verification is not authorized');
  }
  const { hashPassword } = await import('../src/lib/auth');
  const { randomBytes } = await import('node:crypto');
  const temporaryPassword = randomBytes(32).toString('base64url');
  const temporaryHash = await hashPassword(temporaryPassword);
  const changed = await client.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3`,
    [temporaryHash, row.user_id, row.password_hash],
  );
  if ((changed.rowCount ?? 0) !== 1) {
    await client.end();
    throw new Error('Could not establish temporary staging login');
  }
  let sessionCookie = '';
  try {
    const login = await fetch(`${callback.origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: row.email, password: temporaryPassword }),
    });
    const match = login.headers.get('set-cookie')?.match(/auth_token=([^;]+)/);
    if (login.status !== 200 || !match) throw new Error(`Temporary staging login failed with status ${login.status}`);
    sessionCookie = `auth_token=${match[1]}`;
  } finally {
    const restored = await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 AND password_hash = $3`,
      [row.password_hash, row.user_id, temporaryHash],
    );
    await client.end();
    if ((restored.rowCount ?? 0) !== 1) throw new Error('Temporary staging login was not safely restored');
  }
  const headers = { cookie: sessionCookie };
  const [pdfResponse, icsResponse, reportsResponse, pageResponse] = await Promise.all([
    fetch(`${callback.origin}/api/reports/${readingId}/pdf`, { headers, redirect: 'manual' }),
    fetch(`${callback.origin}/api/reports/${readingId}/ics`, { headers, redirect: 'manual' }),
    fetch(`${callback.origin}/api/profile/reports`, { headers, redirect: 'manual' }),
    fetch(`${callback.origin}/reports`, { headers, redirect: 'manual' }),
  ]);
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  const ics = await icsResponse.text();
  const reportsPayload = await reportsResponse.json().catch(() => ({})) as { reports?: any[] };
  const publicReport = Array.isArray(reportsPayload.reports)
    ? reportsPayload.reports.find((report) => Number(report?.id) === readingId)
    : undefined;
  await pageResponse.arrayBuffer();
  return {
    readingId,
    reportId: expectedReportId,
    reportView: {
      apiStatus: reportsResponse.status,
      pageStatus: pageResponse.status,
      pageContentType: pageResponse.headers.get('content-type'),
      present: Boolean(publicReport),
      status: publicReport?.status ?? null,
      type: publicReport?.type ?? null,
      sectionCount: Array.isArray(publicReport?.sections) ? publicReport.sections.length : 0,
      overviewCount: Array.isArray(publicReport?.overview) ? publicReport.overview.length : 0,
      pending: publicReport?.pending === true,
    },
    pdf: {
      status: pdfResponse.status,
      contentType: pdfResponse.headers.get('content-type'),
      disposition: pdfResponse.headers.get('content-disposition'),
      cacheControl: pdfResponse.headers.get('cache-control'),
      bytes: pdf.byteLength,
      magic: pdf.subarray(0, 5).toString('ascii'),
    },
    ics: {
      status: icsResponse.status,
      contentType: icsResponse.headers.get('content-type'),
      disposition: icsResponse.headers.get('content-disposition'),
      cacheControl: icsResponse.headers.get('cache-control'),
      bytes: Buffer.byteLength(ics, 'utf8'),
      eventCount: (ics.match(/BEGIN:VEVENT/g) || []).length,
      validEnvelope: ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'),
    },
  };
}

async function postYearlyPayload(payload: unknown): Promise<number> {
  const webhookUrl = process.env.N8N_REPORT_WEBHOOK_URL;
  const token = process.env.REPORT_PIPELINE_TOKEN;
  if (!webhookUrl || !token) throw new Error('Yearly transit dispatch configuration is missing');
  return new Promise<number>((resolve, reject) => {
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
  const responseStatus = await postYearlyPayload(payload);
  if (responseStatus < 200 || responseStatus >= 300) {
    await query(`UPDATE readings SET pipeline_status = 'dispatch_failed' WHERE id = $1 AND pipeline_status = 'queued'`, [job.readingId]);
    throw new Error(`Yearly transit dispatch failed with status ${responseStatus}`);
  }
  return { readingId: job.readingId, reportId: job.reportId, status: 'queued' };
}
