import type { YearlyTransitFactPack } from './types';
import { validateYearlyTransitAiResponse, aiResponseToPipelineSections } from './aiValidator';
import type { YearlyTransitAiResponse } from './aiSchema';

export interface YearlyTransitApprovedCallback {
  status: 'approved';
  response: YearlyTransitAiResponse;
}
export interface YearlyTransitRejectedCallback {
  status: 'rejected';
  reportId: string;
  reportType: 'yearlytransit';
  versionBundle: YearlyTransitFactPack['versionBundle'];
  rejectReasons: string[];
}
export type YearlyTransitCallback = YearlyTransitApprovedCallback | YearlyTransitRejectedCallback;

export function validateYearlyTransitCallback(value: unknown, pack: YearlyTransitFactPack, reportId: string): YearlyTransitCallback {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid yearly-transit callback envelope');
  const envelope = value as Record<string, unknown>;
  if (envelope.status === 'approved') {
    if (Object.keys(envelope).length !== 2 || !Object.keys(envelope).every((key) => key === 'status' || key === 'response')) throw new Error('invalid yearly-transit callback envelope keys');
    const response = validateYearlyTransitAiResponse(envelope.response, pack, reportId);
    if (aiResponseToPipelineSections(response).length === 0) throw new Error('yearly-transit callback has no deliverable sections');
    return { status: 'approved', response };
  }
  if (envelope.status === 'rejected') {
    const allowed = ['status', 'reportId', 'reportType', 'versionBundle', 'rejectReasons'];
    if (Object.keys(envelope).length !== allowed.length || !Object.keys(envelope).every((key) => allowed.includes(key)) || envelope.reportId !== reportId || envelope.reportType !== 'yearlytransit') throw new Error('invalid yearly-transit rejection envelope');
    if (!envelope.versionBundle || Object.keys(envelope.versionBundle as object).length !== Object.keys(pack.versionBundle).length || Object.entries(pack.versionBundle).some(([key, version]) => (envelope.versionBundle as Record<string, unknown>)[key] !== version)) throw new Error('version bundle');
    if (!Array.isArray(envelope.rejectReasons) || envelope.rejectReasons.length === 0 || envelope.rejectReasons.some((reason) => typeof reason !== 'string' || reason.trim() === '' || reason.length > 240)) throw new Error('invalid rejection reasons');
    return { status: 'rejected', reportId, reportType: 'yearlytransit', versionBundle: pack.versionBundle, rejectReasons: envelope.rejectReasons as string[] };
  }
  throw new Error('invalid yearly-transit callback status');
}
