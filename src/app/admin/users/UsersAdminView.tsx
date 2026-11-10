'use client';

import { useEffect, useState } from 'react';

type User = { id: number; email: string; first_name: string | null; last_name: string | null; role: string; created_at: string | null };
type Data = { summary: { total: number; today: number; week: number; month: number }; daily: { day: string; count: number }[]; users: User[]; total: number; page: number; pageSize: number };
const field = 'w-full rounded-xl border border-white/20 bg-cosmic-950 px-4 py-3 text-white';
const button = 'rounded-xl border border-gold/40 px-4 py-2 text-gold hover:bg-white/5 disabled:opacity-40';

export default function UsersAdminView() {
  const [data, setData] = useState<Data | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetError, setResetError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`/api/admin/users?${new URLSearchParams({ search: filter, page: String(page) })}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load users.');
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filter, page, revision]);

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    if (values.get('newPassword') !== values.get('confirmPassword')) { setResetError('New passwords do not match.'); return; }
    setSaving(true); setResetError('');
    try {
      const response = await fetch('/api/admin/users/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, currentPassword: values.get('currentPassword'), newPassword: values.get('newPassword'), reason: values.get('reason') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to change password.');
      form.reset(); setMessage(`Password updated for ${selected.email}.`); setSelected(null);
    } catch (err) { setResetError(err instanceof Error ? err.message : 'Unable to change password.'); }
    finally { setSaving(false); }
  }

  const maximum = Math.max(1, ...(data?.daily.map((d) => d.count) || []));
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-cosmic-100 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm uppercase tracking-widest text-cosmic-300">Administration</p><h1 className="mt-2 font-serif text-3xl text-gold">Users &amp; signups</h1><p className="mt-2 text-cosmic-300">Account growth and customer support. Signup dates and daily totals use UTC.</p></div>
        <a href="/admin/reports/recovery" className={button}>Paid report recovery</a>
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/40 p-4 text-red-200">{error}</p>}
      {message && <p role="status" className="mt-6 rounded-xl border border-emerald-400/40 p-4 text-emerald-200">{message}</p>}
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy={loading}>
        {([['Total users', data?.summary.total], ['Signed up today', data?.summary.today], ['Last 7 days', data?.summary.week], ['Last 30 days', data?.summary.month]] as const).map(([label, count]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-sm text-cosmic-300">{label}</p><p className="mt-3 text-3xl text-gold">{count?.toLocaleString() ?? '—'}</p></div>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-white/10 p-5" aria-labelledby="signup-chart">
        <h2 id="signup-chart" className="font-serif text-xl text-gold">Daily signups · last 30 days</h2>
        <div className="mt-5 flex h-32 items-end gap-1" role="img" aria-label={data ? data.daily.map((d) => `${d.day}: ${d.count} signups`).join('; ') : 'Loading signup chart'}>
          {data?.daily.map((day) => <div key={day.day} title={`${day.day}: ${day.count} signups`} className="min-w-0 flex-1 rounded-t bg-gold/80" style={{ height: `${day.count ? Math.max(4, day.count / maximum * 100) : 1}%` }} />)}
        </div>
        <div className="mt-2 flex justify-between text-xs text-cosmic-300"><span>{data?.daily[0]?.day}</span><span>{data?.daily[data.daily.length - 1]?.day}</span></div>
        {data && !data.daily.some((d) => d.count) && <p className="mt-3 text-sm text-cosmic-300">No signups in the last 30 days.</p>}
      </section>
      <section className="mt-8" aria-labelledby="user-list">
        <h2 id="user-list" className="font-serif text-xl text-gold">Registered users</h2>
        <form className="my-4 flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); setFilter(search.trim()); setPage(1); }}>
          <label className="min-w-48 flex-1"><span className="sr-only">Search by name or email</span><input className={field} value={search} onChange={(e) => setSearch(e.target.value)} maxLength={150} placeholder="Search by name or email" /></label>
          <button className={button} type="submit">Search</button><button className={button} type="button" onClick={() => setRevision((v) => v + 1)}>Refresh</button>
        </form>
        <p role="status" className="mb-3 text-sm text-cosmic-300">{loading ? 'Loading users…' : data ? `${data.total.toLocaleString()} matching users` : 'Users unavailable'}</p>
        <div className="overflow-x-auto rounded-2xl border border-white/10" aria-busy={loading}>
          <table className="w-full text-left text-sm"><thead className="bg-white/5 text-cosmic-300"><tr>{['User', 'Signed up (UTC)', 'Role', 'Account support'].map((title) => <th key={title} scope="col" className="px-4 py-3">{title}</th>)}</tr></thead>
            <tbody>{data?.users.map((user) => <tr key={user.id} className="border-t border-white/10"><td className="px-4 py-4"><div className="font-medium">{[user.first_name, user.last_name].filter(Boolean).join(' ') || 'Name not provided'}</div><div className="mt-1 text-cosmic-300">{user.email}</div><div className="mt-1 text-xs text-cosmic-300">ID {user.id}</div></td><td className="whitespace-nowrap px-4 py-4">{user.created_at ? new Date(user.created_at).toLocaleString('en-US', { timeZone: 'UTC' }) : 'Unknown'}</td><td className="px-4 py-4">{user.role || 'user'}</td><td className="px-4 py-4">{['admin', 'editor'].includes(user.role) ? <span className="text-cosmic-300">Staff: self-service reset</span> : <button disabled={loading} className={button} onClick={() => { setSelected(user); setResetError(''); setMessage(''); }}>Change password</button>}</td></tr>)}</tbody>
          </table>
          {!loading && data?.users.length === 0 && <p className="p-6 text-cosmic-300">No users match this search.</p>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3"><button className={button} disabled={loading || page <= 1} onClick={() => setPage((v) => v - 1)}>Previous</button><span className="text-sm text-cosmic-300">Page {page} of {Math.max(1, Math.ceil((data?.total || 0) / 25))}</span><button className={button} disabled={loading || !data || page * 25 >= data.total} onClick={() => setPage((v) => v + 1)}>Next</button></div>
      </section>
      {selected && <section className="mt-8 rounded-2xl border border-gold/40 p-6" aria-labelledby="password-heading">
        <h2 id="password-heading" className="font-serif text-xl text-gold">Change password for {selected.email}</h2>
        <p className="mt-3 text-sm text-cosmic-300">This replaces their login password and revokes unused reset links. Existing signed-in sessions remain active. Staff accounts use the <a href="/forgot-password" className="text-gold underline">self-service reset</a>.</p>
        <form onSubmit={resetPassword} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>Your current admin password<input name="currentPassword" type="password" autoComplete="current-password" required className={`${field} mt-2`} /></label>
          <label>Support reason<input name="reason" required minLength={5} maxLength={500} className={`${field} mt-2`} placeholder="Customer requested account access help" /></label>
          <label>New customer password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required className={`${field} mt-2`} /></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={72} required className={`${field} mt-2`} /></label>
          <p className="text-sm text-cosmic-300 sm:col-span-2">Use at least 12 characters. Share the new password through your established customer support channel.</p>
          {resetError && <p role="alert" className="text-red-200 sm:col-span-2">{resetError}</p>}
          <div className="flex gap-3 sm:col-span-2"><button className={button} disabled={saving} type="submit">{saving ? 'Updating…' : 'Confirm password change'}</button><button type="button" className={button} disabled={saving} onClick={() => setSelected(null)}>Cancel</button></div>
        </form>
      </section>}
    </div>
  );
}
