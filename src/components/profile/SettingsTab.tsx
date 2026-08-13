'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  horoscope_sign: string | null;
  patterns_opt_in: boolean;
}

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

export default function SettingsTab({ user: initialUser }: { user: User }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [displayName, setDisplayName] = useState(initialUser.display_name || '');
  const [horoscopeSign, setHoroscopeSign] = useState(initialUser.horoscope_sign || '');
  const [patternsOptIn, setPatternsOptIn] = useState(initialUser.patterns_opt_in);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Seed from /api/profile (returns display_name, horoscope_sign, patterns_opt_in),
  // which /api/auth/user omits — otherwise saving would wipe a previously set value.
  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.user) return;
        if (d.user.display_name !== undefined && d.user.display_name !== null) {
          setDisplayName(d.user.display_name);
        }
        if (d.user.horoscope_sign !== undefined && d.user.horoscope_sign !== null) {
          setHoroscopeSign(d.user.horoscope_sign);
        }
        if (typeof d.user.patterns_opt_in === 'boolean') {
          setPatternsOptIn(d.user.patterns_opt_in);
        }
      })
      .catch(() => {});
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/profile/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          horoscope_sign: horoscopeSign,
          patterns_opt_in: patternsOptIn,
        }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function changePassword() {
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: currentPassword, next: nextPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMsg({ ok: true, text: 'Password updated.' });
        setCurrentPassword('');
        setNextPassword('');
      } else {
        setPasswordMsg({ ok: false, text: data.error || 'Failed to update password.' });
      }
    } catch {
      setPasswordMsg({ ok: false, text: 'Failed to update password.' });
    }
  }

  async function exportData() {
    const res = await fetch('/api/profile/export');
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmic-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    try {
      const res = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      }
    } catch {}
  }

  return (
    <div className="space-y-8">
      <div className="glass-panel glow-border rounded-2xl p-6">
        <h3 className="font-serif text-xl font-bold text-gold mb-4">
          <i className="fa-solid fa-user mr-2"></i>Profile
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm uppercase tracking-widest text-cosmic-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to be known"
              className="mt-1 w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm uppercase tracking-widest text-cosmic-300">Email</label>
            <p className="mt-1 text-cosmic-200">{user.email}</p>
          </div>
          <div>
            <label className="text-sm uppercase tracking-widest text-cosmic-300">Horoscope Sign</label>
            <select
              value={horoscopeSign}
              onChange={(e) => setHoroscopeSign(e.target.value)}
              className="mt-1 w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 focus:border-gold focus:outline-none"
            >
              <option value="">— Select —</option>
              {SIGNS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cosmic-100">Patterns opt-in</p>
              <p className="text-xs text-cosmic-300">Allow pattern analysis across your readings</p>
            </div>
            <button
              role="switch"
              aria-checked={patternsOptIn}
              aria-label="Allow pattern analysis across your readings"
              onClick={() => setPatternsOptIn(!patternsOptIn)}
              className={`relative w-12 h-6 rounded-full transition ${
                patternsOptIn ? 'bg-gradient-to-r from-cosmic-primary to-cosmic-secondary' : 'bg-cosmic-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  patternsOptIn ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="glass-panel glow-border rounded-2xl p-6">
        <h3 className="font-serif text-xl font-bold text-gold mb-4">
          <i className="fa-solid fa-key mr-2"></i>Change Password
        </h3>
        <div className="space-y-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
          />
          <input
            type="password"
            value={nextPassword}
            onChange={(e) => setNextPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            className="w-full rounded-lg bg-cosmic-950/80 border border-cosmic-700 p-3 text-cosmic-100 placeholder-cosmic-500 focus:border-gold focus:outline-none"
          />
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.ok ? 'text-green-400' : 'text-red-400'}`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            onClick={changePassword}
            className="bg-gradient-to-r from-cosmic-primary to-cosmic-secondary text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:opacity-90 transition"
          >
            Update Password
          </button>
        </div>
      </div>

      <div className="glass-panel glow-border rounded-2xl p-6">
        <h3 className="font-serif text-xl font-bold text-gold mb-4">
          <i className="fa-solid fa-download mr-2"></i>Export Data
        </h3>
        <p className="text-cosmic-200 mb-4">
          Download all your natal charts, readings, and reflections as JSON.
        </p>
        <button
          onClick={exportData}
          className="border border-gold/50 text-gold px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:bg-gold/10 transition"
        >
          Export My Data
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-red-500/30">
        <h3 className="font-serif text-xl font-bold text-red-400 mb-4">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>Danger Zone
        </h3>
        <p className="text-cosmic-200 mb-4">
          Permanently delete your account and all data. This cannot be undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="border border-red-500/50 text-red-400 px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:bg-red-500/10 transition"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-red-400 text-sm">
              Are you absolutely sure? This will delete all your charts, readings, and reflections.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteAccount}
                className="bg-red-600 text-white px-6 py-2.5 rounded-full uppercase tracking-widest text-sm font-semibold hover:bg-red-700 transition"
              >
                Yes, Delete Everything
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="border border-cosmic-700 text-cosmic-300 px-6 py-2.5 rounded-full uppercase tracking-widest text-sm hover:border-gold hover:text-gold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
