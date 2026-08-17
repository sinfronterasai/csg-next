import { computeChart } from '@/lib/chartEngine';

describe('computeChart for a non-table city (the bug)', () => {
  it('Austin, TX now computes a full chart instead of throwing', async () => {
    const c = await computeChart({ date: '1990-06-15', time: '12:00', location: 'Austin, TX' });
    expect(c.planets.length).toBe(12);
    expect(c.sun).toBeDefined();
    expect(c.ascendant).toBeDefined();
    expect(c.houses.length).toBe(12);
    console.log('AUSTIN sun', c.sun.signLabel, 'asc', c.ascendant.signLabel, 'tz-derived houses ok');
  });

  it('unknown-time path still works for a real city', async () => {
    const c = await computeChart({ date: '1990-06-15', location: 'Berlin, Germany', unknownTime: true });
    expect(c.planets.length).toBe(12);
    expect(c.sun.house).toBeNull();
  });
});
