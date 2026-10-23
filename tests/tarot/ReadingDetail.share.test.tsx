/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import ReadingDetailPage from '@/app/tarot/reading/[id]/page';
jest.mock('next/navigation', () => ({ useParams: () => ({ id: '123' }) }));
jest.mock('@/components/tarot/ReadingShare', () => ({ __esModule: true, default: ({ reading }: any) => <button>Share {reading.cards[0].positionLabel}: {reading.cards[0].name}</button> }));
it('opens the actual saved API cards/positions contract without expecting drawn', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
    id: 123, spreadId: 'past_present_future', question: 'A sample question',
    cards: [{ name: 'The Sun', reversed: false, image: '/sun.png' }],
    positions: [{ label: 'Past', meaning: 'Past influences' }],
    interpretation: 'A sample reading', createdAt: '2026-10-23',
  }) });
  render(<ReadingDetailPage />);
  await screen.findByRole('button', { name: 'Share Past: The Sun' });
  expect(screen.getByRole('img', { name: 'The Sun' }).getAttribute('src')).toBe('/sun.png');
});
