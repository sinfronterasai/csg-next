import { NextResponse } from 'next/server';

function getSunSign(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const m = d.getUTCMonth() + 1, day = d.getUTCDate();
    if ((m===3&&day>=21)||(m===4&&day<=19)) return 'Aries';
    if ((m===4&&day>=20)||(m===5&&day<=20)) return 'Taurus';
    if ((m===5&&day>=21)||(m===6&&day<=20)) return 'Gemini';
    if ((m===6&&day>=21)||(m===7&&day<=22)) return 'Cancer';
    if ((m===7&&day>=23)||(m===8&&day<=22)) return 'Leo';
    if ((m===8&&day>=23)||(m===9&&day<=22)) return 'Virgo';
    if ((m===9&&day>=23)||(m===10&&day<=22)) return 'Libra';
    if ((m===10&&day>=23)||(m===11&&day<=21)) return 'Scorpio';
    if ((m===11&&day>=22)||(m===12&&day<=21)) return 'Sagittarius';
    if ((m===12&&day>=22)||(m===1&&day<=19)) return 'Capricorn';
    if ((m===1&&day>=20)||(m===2&&day<=18)) return 'Aquarius';
    return 'Pisces';
  } catch { return 'Aries'; }
}

const MATCHES: Record<string, { best: string[]; worst: string[] }> = {
  Aries: { best: ['Leo','Sagittarius','Gemini','Aquarius'], worst: ['Cancer','Capricorn'] },
  Taurus: { best: ['Virgo','Capricorn','Cancer','Pisces'], worst: ['Leo','Aquarius'] },
  Gemini: { best: ['Libra','Aquarius','Aries','Leo'], worst: ['Virgo','Pisces'] },
  Cancer: { best: ['Scorpio','Pisces','Taurus','Virgo'], worst: ['Aries','Libra'] },
  Leo: { best: ['Aries','Sagittarius','Gemini','Libra'], worst: ['Taurus','Scorpio'] },
  Virgo: { best: ['Taurus','Capricorn','Cancer','Scorpio'], worst: ['Gemini','Sagittarius'] },
  Libra: { best: ['Gemini','Aquarius','Leo','Sagittarius'], worst: ['Cancer','Capricorn'] },
  Scorpio: { best: ['Cancer','Pisces','Virgo','Capricorn'], worst: ['Leo','Aquarius'] },
  Sagittarius: { best: ['Aries','Leo','Libra','Aquarius'], worst: ['Virgo','Pisces'] },
  Capricorn: { best: ['Taurus','Virgo','Scorpio','Pisces'], worst: ['Aries','Libra'] },
  Aquarius: { best: ['Gemini','Libra','Aries','Sagittarius'], worst: ['Taurus','Scorpio'] },
  Pisces: { best: ['Cancer','Scorpio','Taurus','Capricorn'], worst: ['Gemini','Sagittarius'] },
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const sign1 = getSunSign(body.person1BirthDate);
    const sign2 = getSunSign(body.person2BirthDate);
    const match = MATCHES[sign1] || { best: [], worst: [] };
    let score = 65, label = 'Good';
    if (match.best.includes(sign2)) { score = 85; label = 'Excellent'; }
    else if (match.worst.includes(sign2)) { score = 45; label = 'Challenging'; }
    return NextResponse.json({
      success: true, preview: true, sign1, sign2, score, label,
      text: `${sign1} meets ${sign2}: an immediate ${score >= 80 ? 'spark' : score >= 60 ? 'connection' : 'tension'} shapes how these energies interact. Sign in to unlock the full synastry report.`,
      message: 'This is a free sun-sign preview. Sign in for full synastry details.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Preview unavailable', details: err?.message }, { status: 400 });
  }
}
