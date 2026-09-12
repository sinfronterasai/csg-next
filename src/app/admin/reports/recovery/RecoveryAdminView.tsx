'use client';

import { useEffect, useMemo, useState } from 'react';

type Eligibility = { enabled: boolean; reasonCode: string };
type Report = { id: number; title: string | null; reportType: string; status: string; createdAt: string; attempt: number; expectedReportId: string | null; actions: { correction: Eligibility; rework: Eligibility } };
type Preview = { oldReportId: string; digest: string; birthData: { firstName?: string; dob: string; birthTime: string | null; place: string; lat: number; lon: number; tz: string; solarFallback: boolean } };

const statusText: Record<string, string> = { queued: 'Queued', processing: 'Processing', needs_editor: 'Needs editor', rejected: 'Rejected', dispatch_failed: 'Dispatch failed', approved: 'Approved', error: 'Error' };
const reasonText: Record<string, string> = {
  audit_only: 'Audit-only: already approved.', editor_review_required: 'Locked pending editorial review.', failure_evidence_required: 'Locked until authenticated failure evidence exists.',
  authenticated_failure: 'Authenticated failure evidence found.', dispatch_failed: 'Dispatch failed; rework is available.', pipeline_error: 'Pipeline error; rework is available.', rejected_with_snapshot: 'Rejected with a verified snapshot.',
  snapshot_missing: 'Locked: immutable snapshot is unavailable.', correction_not_verified: 'No verified correction signature.', known_invalid_signature: 'Audited correction signature matched.', unsupported_status: 'No operation is defined for this state.',
};

export default function RecoveryAdminView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<'load' | 'preview' | 'approve' | 'rework' | null>('load');
  const [message, setMessage] = useState<string | null>(null);
  const selected = useMemo(() => reports.find((report) => report.id === selectedId) ?? null, [reports, selectedId]);

  useEffect(() => { void loadReports(); }, []);
  async function loadReports() {
    setBusy('load'); setMessage(null);
    try {
      const res = await fetch('/api/admin/reports', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setMessage('You do not have access to recovery operations.'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error('Could not load recovery queue.');
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch { setMessage('Recovery queue unavailable. Retry without creating a second attempt.'); }
    finally { setBusy(null); }
  }
  async function selectReport(report: Report) {
    setSelectedId(report.id); setPreview(null); setConfirmed(false); setReason(''); setMessage(null);
    if (!report.actions.correction.enabled || !report.expectedReportId) return;
    setBusy('preview');
    try {
      const res = await fetch(`/api/reports/${report.id}/correction`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preview', expectedReportId: report.expectedReportId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview unavailable.');
      setPreview(data.summary ?? { oldReportId: data.oldReportId, digest: data.digest, birthData: data.snapshot?.birthData });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Preview unavailable. No changes were made.'); }
    finally { setBusy(null); }
  }
  async function act(action: 'approve' | 'rework') {
    if (!selected || !selected.expectedReportId || reason.trim().length < 5) return;
    if (action === 'approve' && !confirmed) return;
    if (action === 'approve' && (!selected.actions.correction.enabled || !preview)) return;
    if (action === 'rework' && !selected.actions.rework.enabled) return;
    setBusy(action); setMessage(null);
    const body = action === 'approve' ? { action: 'approve', expectedReportId: selected.expectedReportId, digest: preview!.digest, reason: reason.trim() } : { expectedReportId: selected.expectedReportId, reason: reason.trim() };
    try {
      const res = await fetch(`/api/reports/${selected.id}/${action === 'approve' ? 'correction' : 'rework'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation was not accepted.');
      setMessage(action === 'approve' ? 'Correction approved and queued. Refresh before any further action.' : 'Rework queued. Refresh before any further action.');
      setReports((current) => current.map((report) => report.id === selected.id ? { ...report, status: 'queued', attempt: report.attempt + 1, actions: { correction: { enabled: false, reasonCode: 'failure_evidence_required' }, rework: { enabled: false, reasonCode: 'failure_evidence_required' } } } : report));
      setPreview(null); setConfirmed(false); setReason('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operation could not be confirmed. Inspect the queue before retrying.'); }
    finally { setBusy(null); }
  }

  return <section className="mx-auto max-w-7xl px-6 py-12" data-testid="paid-recovery-admin">
    <div className="mb-10"><p className="text-xs uppercase tracking-[0.35em] text-gold">Staging operations</p><h1 className="mt-3 font-serif text-4xl text-white">Paid report recovery</h1><p className="mt-3 max-w-2xl text-cosmic-200">All paid intervention states are shown with server-derived, fail-closed action eligibility.</p></div>
    {message && <div role="status" className="mb-6 rounded-2xl border border-gold/30 bg-gold/10 p-4 text-sm text-gold">{message}</div>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
      <div className="glass-panel rounded-3xl p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-serif text-xl text-white">Paid operations queue</h2><button onClick={loadReports} disabled={busy !== null} className="rounded-full border border-gold/40 px-3 py-1 text-xs uppercase tracking-widest text-gold">Refresh</button></div>
        {busy === 'load' ? <p className="text-sm text-cosmic-300">Loading queue…</p> : reports.length === 0 ? <p className="text-sm text-cosmic-300">No paid reports in the intervention states.</p> : <div className="space-y-3">{reports.map((report) => <button key={report.id} onClick={() => void selectReport(report)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === report.id ? 'border-gold/70 bg-gold/10' : 'border-white/10 bg-white/[.03] hover:border-gold/40'}`}><div className="flex items-start justify-between gap-4"><span className="font-medium text-white">Report #{report.id}</span><span className="rounded-full border border-white/15 px-2 py-1 text-[10px] uppercase tracking-wider text-cosmic-200">{statusText[report.status] ?? 'Pending review'}</span></div><div className="mt-2 text-sm text-cosmic-200">{report.title ?? report.reportType} · attempt {report.attempt}</div><div className="mt-1 text-xs text-cosmic-400">Created {new Date(report.createdAt).toLocaleString()}</div><div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider"><span className={report.actions.rework.enabled ? 'text-gold' : 'text-cosmic-400'}>Rework: {report.actions.rework.enabled ? 'available' : 'unavailable'}</span><span className={report.actions.correction.enabled ? 'text-gold' : 'text-cosmic-400'}>Correction: {report.actions.correction.enabled ? 'available' : 'unavailable'}</span></div></button>)}</div>}
      </div>
      <div className="glass-panel rounded-3xl p-5"><h2 className="font-serif text-xl text-white">Action eligibility</h2>{!selected && <p className="mt-5 text-sm text-cosmic-300">Select a report to inspect its safe action reasons.</p>}{selected && <div className="mt-5 space-y-5 text-sm"><label className="block"><span className="text-cosmic-300">Operator reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-white" placeholder="Explain the verified correction or rework." /></label><div className="rounded-2xl border border-white/10 p-4"><p className="text-xs uppercase tracking-widest text-cosmic-400">Rework</p><p className="mt-2 text-cosmic-200">{reasonText[selected.actions.rework.reasonCode] ?? 'Unavailable.'}</p><button onClick={() => void act('rework')} disabled={!selected.actions.rework.enabled || busy !== null || reason.trim().length < 5} className="mt-3 rounded-full border border-gold/40 px-4 py-2 text-xs uppercase tracking-widest text-gold disabled:cursor-not-allowed disabled:opacity-40">Queue rework</button></div>{selected.actions.correction.enabled && (busy === 'preview' ? <p className="text-sm text-cosmic-300">Building a verified preview…</p> : preview && <><dl className="grid grid-cols-2 gap-3"><div><dt className="text-cosmic-400">Birth date</dt><dd className="text-white">{preview.birthData.dob}</dd></div><div><dt className="text-cosmic-400">Birth time</dt><dd className="text-white">{preview.birthData.birthTime ?? 'Unknown'}</dd></div><div><dt className="text-cosmic-400">Place</dt><dd className="text-white">{preview.birthData.place}</dd></div><div><dt className="text-cosmic-400">Verified timezone</dt><dd className="text-white">{preview.birthData.tz}</dd></div></dl><div className="rounded-2xl border border-white/10 p-4"><p className="text-xs uppercase tracking-widest text-cosmic-400">Previous report correlation</p><code className="mt-2 block break-all text-xs text-cosmic-200">{preview.oldReportId}</code><p className="mt-4 text-xs uppercase tracking-widest text-cosmic-400">Corrected snapshot digest</p><code className="mt-2 block break-all text-xs text-gold">{preview.digest}</code></div><label className="block"><span className="text-cosmic-300">Operator reason</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 p-3 text-white" placeholder="Explain the verified correction or rework." /></label><label className="flex items-start gap-2 text-cosmic-300"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I verified the digest above exactly.</label><button onClick={() => void act('approve')} disabled={busy !== null || !confirmed || reason.trim().length < 5} className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-cosmic-950 disabled:opacity-40">Approve correction</button></>)}</div>}</div>
    </div>
  </section>;
}
