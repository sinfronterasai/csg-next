import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

const DECK = [
  'The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Hierophant',
  'The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice',
  'The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun',
  'Judgement','The World','Ace of Wands','Two of Wands','Three of Wands','Four of Wands','Five of Wands',
  'Six of Wands','Seven of Wands','Eight of Wands','Nine of Wands','Ten of Wands','Page of Wands','Knight of Wands','Queen of Wands','King of Wands',
];

function draw(n: number) {
  const pool = [...DECK];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 });
    }
    if (!verifyToken(token)) {
      return NextResponse.json({ error: 'Unauthorized. Please login.' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const count = typeof body.cardCount === 'number' ? body.cardCount : 3;
    const cards = draw(Math.min(Math.max(count, 1), 12));
    const reading = {
      id: `tarot_${Date.now()}`,
      cards,
      interpretation: `Your spread reveals ${cards.join(', ')}. (Generated reading — wire Groq for full interpretation.)`,
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ success: true, reading });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate reading' }, { status: 500 });
  }
}
