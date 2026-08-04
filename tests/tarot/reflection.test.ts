import { saveReading, getReading, updateReflection, deleteReading } from '@/lib/tarot/store';

const OWNER = -910001;
const OTHER = -910002;
const created: number[] = [];

afterAll(async () => {
  for (const id of created) await deleteReading(id).catch(() => {});
  const { pool } = await import('@/lib/db');
  await new Promise((r) => setTimeout(r, 100));
  await pool.end().catch(() => {});
});

describe('reflection journal (ownership-enforced)', () => {
  it('owner can save a reflection and read it back', async () => {
    const r = await saveReading({
      userId: OWNER, spreadId: 'one_card', question: 'reflect q',
      category: null, positions: [{ label: 'G', meaning: '' }],
      cards: [{ name: 'The Sun', reversed: false }], interpretation: 'i',
    });
    created.push(r.id);
    const updated = await updateReflection(r.id, OWNER, 'I felt hopeful.');
    expect(updated.reflection).toBe('I felt hopeful.');
    const got = await getReading(r.id, OWNER);
    expect(got!.reflection).toBe('I felt hopeful.');
  });

  it('another user cannot write a reflection on a reading they do not own', async () => {
    const r = await saveReading({
      userId: OWNER, spreadId: 'one_card', question: 'private',
      category: null, positions: [{ label: 'G', meaning: '' }],
      cards: [{ name: 'The Moon', reversed: false }], interpretation: 'i2',
    });
    created.push(r.id);
    const denied = await updateReflection(r.id, OTHER, 'hacked');
    expect(denied).toBeNull();
    const got = await getReading(r.id, OWNER);
    expect(got!.reflection).toBeNull();
  });

  it('returns null for a non-existent reading', async () => {
    expect(await updateReflection(-1, OWNER, 'x')).toBeNull();
  });
});
