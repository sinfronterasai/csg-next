import { NextRequest } from 'next/server';
import { POST } from '@/app/api/moon-calculator/route';

describe('Moon calculator API contract', () => {
  function request(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/moon-calculator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns HTTP 400 for impossible calendar dates', async () => {
    const response = await POST(request({ date: '2026-02-30', time: '12:00', location: 'Paris, France' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('valid calendar date') });
  });

  it('returns HTTP 400 for invalid times', async () => {
    const response = await POST(request({ date: '2024-02-29', time: '25:61', location: 'Paris, France' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('valid 24-hour time') });
  });

  it('returns HTTP 400 for non-boolean unknownTime values', async () => {
    const response = await POST(request({ date: '2024-02-29', time: '12:00', location: 'Paris, France', unknownTime: 'false' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('unknownTime must be a boolean') });
  });

  it.each([0, false, null])('returns HTTP 400 for malformed present time %p with unknownTime enabled', async (time) => {
    const response = await POST(request({ date: '2024-02-29', time, location: 'Paris, France', unknownTime: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('valid 24-hour time') });
  });

  it('returns HTTP 400 for malformed JSON', async () => {
    const malformed = new NextRequest('http://localhost/api/moon-calculator', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    const response = await POST(malformed);
    expect(response.status).toBe(400);
  });

  it('returns the timestamped phase contract for valid input', async () => {
    const response = await POST(request({ date: '1990-06-15', time: '12:00', location: 'Paris, France' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.moonPhase).toEqual(expect.objectContaining({
      phase: expect.any(Number),
      label: expect.any(String),
      illuminationPercent: expect.any(Number),
      evaluatedAtUtc: expect.stringMatching(/Z$/),
    }));
  });
});
