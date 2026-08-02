import { NextResponse } from 'next/server';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

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

const BLURBS: Record<string,string> = {
  Aries: 'Channel your fire into a single bold move today.',
  Taurus: 'Steady progress beats rushed ambition. Trust the pace.',
  Gemini: 'A conversation opens a door you didn’t know was closed.',
  Cancer: 'Protect your energy; say no without guilt.',
  Leo: 'Your visibility is rising — step into it.',
  Virgo: 'Small systems fix big friction. Tidy one workflow.',
  Libra: 'Balance isn’t compromise; it’s leverage. Negotiate.',
  Scorpio: 'Go deeper on one thing instead of wider on many.',
  Sagittarius: 'A distant idea becomes a near-term plan.',
  Capricorn: 'Discipline today compounds into freedom later.',
  Aquarius: 'Your unconventional take is the asset, not the risk.',
  Pisces: 'Intuition is data. Act on the quiet signal.',
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sign = (searchParams.get('sign') || '').trim() || SIGNS[new Date().getUTCDate() % 12];
    const matched = SIGNS.find((s) => s.toLowerCase() === sign.toLowerCase()) || sign;
    return NextResponse.json({
      success: true,
      sign: matched,
      date: new Date().toISOString().slice(0,10),
      horoscope: BLURBS[matched] || 'The stars whisper; listen closely.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Horoscope unavailable' }, { status: 400 });
  }
}
