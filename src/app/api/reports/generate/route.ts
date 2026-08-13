import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken, getUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { generateText, GROQ_MODEL } from '@/lib/groq';
import { saveUniversalReading } from '@/lib/profile/store';

const REPORT_NAMES: Record<string, string> = {
  transit: 'Yearly Transit Forecast',
  synastry: 'Synastry Love Report',
  vocation: 'Vocation and Wealth Map',
};

const REPORT_PRICES: Record<string, number> = {
  transit: 49,
  synastry: 65,
  vocation: 55,
};

async function getSavedChart(userId: string) {
  const { rows } = await query(
    'SELECT * FROM natal_charts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [userId],
  );
  if (rows.length === 0) return null;
  const c = rows[0];
  const natal = typeof c.natal_positions === 'string' ? JSON.parse(c.natal_positions) : c.natal_positions;
  const houses = typeof c.houses === 'string' ? JSON.parse(c.houses) : c.houses;
  return {
    birthInfo: { date: c.birth_date, time: c.birth_time, location: c.location_name, latitude: c.latitude, longitude: c.longitude },
    planets: natal?.planets || [],
    houses: houses || [],
    ascendant: c.ascendant,
    midheaven: c.midheaven,
  };
}

function chartSummary(chart: any): string {
  if (!chart) return '';
  const planets = chart.planets.map((p: any) => `${p.label} in ${p.signLabel}${p.house ? ` (House ${p.house})` : ''}`).join(', ');
  const asc = chart.ascendant?.signLabel ? `Ascendant in ${chart.ascendant.signLabel}` : '';
  const mc = chart.midheaven?.signLabel ? `Midheaven in ${chart.midheaven.signLabel}` : '';
  return `Birth: ${chart.birthInfo.date} ${chart.birthInfo.time} @ ${chart.birthInfo.location}.\nPlanets: ${planets}.\n${asc}. ${mc}.`;
}

const SYSTEM = 'You are an elite astrologer for Cosmic Spirit Guide. Write in warm, grounded, mystical-but-direct prose. Use Markdown with **bold** for key terms. No HTML. Give specific, actionable insight the reader can use.';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const user = await getUserById(decoded.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { type, partner } = body; // type: transit | synastry | vocation

    const chart = await getSavedChart(decoded.userId);
    if (!chart) {
      return NextResponse.json({ error: 'Create your birth chart first', requiresBirthChart: true }, { status: 400 });
    }

    let prompt = '';
    if (type === 'transit') {
      prompt = `Generate a Yearly Transit Forecast for the coming 12 months.\n\nUser chart:\n${chartSummary(chart)}\n\nCover the major planetary transits affecting this person's Sun, Moon, Ascendant, and angles. Give 3-4 dated periods with concrete guidance. End with a "Power Move" for the year.`;
    } else if (type === 'vocation') {
      prompt = `Generate a Vocation & Wealth Map report.\n\nUser chart:\n${chartSummary(chart)}\n\nFocus on the Midheaven (MC), 2nd House (resources), 10th House (career), and Saturn. Identify career strengths, financial patterns, and a concrete next step for professional alignment.`;
    } else if (type === 'synastry') {
      if (!partner || !partner.birthDate) {
        return NextResponse.json({ error: 'Partner birth date required for synastry' }, { status: 400 });
      }
      prompt = `Generate a Synastry Love Report comparing two people.\n\nPerson 1 (user) chart:\n${chartSummary(chart)}\n\nPerson 2 (partner): born ${partner.birthDate}${partner.birthTime ? ' at ' + partner.birthTime : ''}${partner.location ? ' in ' + partner.location : ''}.\n\nAnalyze compatibility across communication, emotional connection, passion, and growth edges. Give an overall compatibility read and one concrete relationship practice.`;
    } else {
      return NextResponse.json({ error: 'Unknown report type' }, { status: 400 });
    }

    const text = await generateText(prompt, { systemPrompt: SYSTEM, model: GROQ_MODEL, max_tokens: 2000 });

    // Persist the report to the unified readings journal
    let readingId: number | undefined;
    try {
      const title = REPORT_NAMES[type] || `${type} report`;
      const pricePaid = REPORT_PRICES[type] || 0;
      const row = await saveUniversalReading({
        userId: Number(decoded.userId),
        type: 'report',
        title,
        question: `${title} report`,
        pricePaid,
        partnerLabel: type === 'synastry' && partner?.birthDate ? `Partner ${partner.birthDate}` : undefined,
        result: {
          title,
          text,
          generatedFor: type === 'synastry' && partner ? 'partner' : 'self',
          pricePaid,
        },
      });
      readingId = row.id;
    } catch (err) {
      console.error('[reports/generate] failed to persist report:', err);
      // Still return success — generation worked, persistence is best-effort
    }

    return NextResponse.json({ success: true, type, text, readingId });
  } catch (err: any) {
    const msg = err?.message || 'Report generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
