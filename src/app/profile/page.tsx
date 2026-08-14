'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import TabBar, { type TabId } from '@/components/profile/TabBar';
import OverviewTab from '@/components/profile/OverviewTab';
import ChartsTab from '@/components/profile/ChartsTab';
import ReportsTab from '@/components/profile/ReportsTab';
import TarotJournalTab from '@/components/profile/TarotJournalTab';
import HoroscopeLogTab from '@/components/profile/HoroscopeLogTab';
import PatternsTab from '@/components/profile/PatternsTab';
import SettingsTab from '@/components/profile/SettingsTab';

interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  horoscope_sign: string | null;
  patterns_opt_in: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Open the tab named in ?tab= (e.g. /profile?tab=reports from a report's
  // "View in Library" link) so the link lands on the right section.
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview','charts','reports','tarot','horoscope','patterns','settings'].includes(tab)) {
      setActiveTab(tab as TabId);
    }
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/user');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!data.user) {
          router.push('/login');
          return;
        }
        setUser(data.user);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen bg-cosmic-950 pt-32 text-cosmic-200">
        <div className="text-center">Loading…</div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-cosmic-950 px-4 text-cosmic-100">
      <div className="mx-auto max-w-5xl pt-20 pb-16">
        <h1 className="glow-text-gold font-serif text-center text-4xl font-bold text-gold mb-8">
          Your Cosmic Profile
        </h1>

        <TabBar active={activeTab} onChange={setActiveTab} />

        <div className="mt-8">
          {activeTab === 'overview' && <OverviewTab user={user} onNavigate={(tab) => setActiveTab(tab as TabId)} />}
          {activeTab === 'charts' && <ChartsTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'tarot' && <TarotJournalTab />}
          {activeTab === 'horoscope' && <HoroscopeLogTab />}
          {activeTab === 'patterns' && <PatternsTab />}
          {activeTab === 'settings' && <SettingsTab user={user} />}
        </div>
      </div>
    </main>
  );
}
