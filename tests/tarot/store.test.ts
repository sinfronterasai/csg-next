import { saveReading, listReadings, getReading, deleteReading } from '@/lib/tarot/store';

// Sentinel users (no FK enforced on readings.user_id). Cleaned up in afterAll.
const OWNER = -900001;
const OTHER = -900002;
const created: number[] = [];

afterAll(async () => {
  for (const id of created) {
    await deleteReading(id).catch(() => {});
  }
});

describe('readings store', () => {
  it('saveReading persists a tarot reading and returns it with an id', async () => {
    const r = await saveReading({
      userId: OWNER,
      spreadId: 'celtic_cross',
      question: 'What should I focus on?',
      category: 'general',
      positions: [{ label: 'Present', meaning: 'Now' }],
      cards: [{ name: 'The Sun', reversed: false }],
      interpretation: 'A bright outcome.',
      astrology: { sunSign: 'capricorn' },
    });
    expect(r.id).toBeDefined();
    expect(typeof r.id).toBe('number');
    expect(r.spreadId).toBe('celtic_cross');
    expect(r.interpretation).toBe('A bright outcome.');
    created.push(r.id);
  });

  it('listReadings returns the owner\'s readings ordered newest-first', async () => {
    const r = await saveReading({
      userId: OWNER,
      spreadId: 'one_card',
      question: 'Quick q',
      category: 'love',
      positions: [{ label: 'Guidance', meaning: 'x' }],
      cards: [{ name: 'The Moon', reversed: true }],
      interpretation: 'Trust intuition.',
    });
    created.push(r.id);

    const list = await listReadings(OWNER);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
    // newest first
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(list[i].createdAt).getTime(),
      );
    }
    // contains both our categories
    const cats = list.map((x) => x.category);
    expect(cats).toEqual(expect.arrayContaining(['general', 'love']));
  });

  it('getReading enforces ownership: owner sees it, other user gets null', async () => {
    const r = await saveReading({
      userId: OWNER,
      spreadId: 'past_present_future',
      question: 'owner only',
      category: 'career',
      positions: [{ label: 'Past', meaning: 'p' }],
      cards: [{ name: 'The Star', reversed: false }],
      interpretation: 'Hopeful.',
    });
    created.push(r.id);

    const owned = await getReading(r.id, OWNER);
    expect(owned).not.toBeNull();
    expect(owned!.id).toBe(r.id);

    const denied = await getReading(r.id, OTHER);
    expect(denied).toBeNull();
  });

  it('getReading returns null for a non-existent id', async () => {
    expect(await getReading(-1, OWNER)).toBeNull();
  });
});

// Release the shared pg pool so jest exits cleanly.
import { pool } from '@/lib/db';
afterAll(async () => {
  await new Promise((res) => setTimeout(res, 100));
  await pool.end().catch(() => {});
});
