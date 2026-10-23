/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReadingShare from '@/components/tarot/ReadingShare';
import { buildReadingView } from '@/lib/tarot/view';
import { readingShareCaption, renderReadingShare } from '@/lib/tarot/share';

jest.mock('@/lib/tarot/share', () => ({
  ...jest.requireActual('@/lib/tarot/share'),
  renderReadingShare: jest.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
const reading = buildReadingView({
  spreadId: 'past_present_future', question: 'A private relationship question',
  drawn: [{ name: 'The Sun', reversed: true, positionLabel: 'Past', reversedMeaning: 'Finding inner joy' }],
  interpretation: 'Private full interpretation', reflection: 'Private journal',
  astrology: { summary: 'Private birth details' }, readingId: 12,
});
beforeEach(() => {
  jest.clearAllMocks();
  URL.createObjectURL = jest.fn(() => 'blob:preview');
  URL.revokeObjectURL = jest.fn();
});
it('excludes private fields and the question from the default caption', () => {
  const text = readingShareCaption(reading);
  expect(text).toContain('Past: The Sun (reversed)');
  for (const privateText of [reading.question, reading.interpretation, reading.reflection!, reading.astrology!.summary]) expect(text).not.toContain(privateText);
  expect(readingShareCaption(reading, true)).toContain(reading.question);
});
it('previews feed PNG with question off, allows explicit opt-in and story format', async () => {
  render(<ReadingShare reading={reading} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share my reading' }));
  await screen.findByAltText('Preview of your shareable tarot reading');
  expect(renderReadingShare).toHaveBeenLastCalledWith(reading, 'feed', false);
  expect(screen.getByRole('checkbox').getAttribute('checked')).toBeNull();
  expect(screen.getByRole('link', { name: 'Download PNG' }).getAttribute('download')).toBe('my-tarot-feed.png');
  expect(screen.queryByRole('button', { name: 'Share image' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(renderReadingShare).toHaveBeenLastCalledWith(reading, 'feed', true));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'story' } });
  await waitFor(() => expect(renderReadingShare).toHaveBeenLastCalledWith(reading, 'story', true));
});
it('leaves a selectable caption when clipboard access fails', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) } });
  render(<ReadingShare reading={reading} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share my reading' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy caption' }));
  await screen.findByText('Select and copy the caption below.');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).not.toContain(reading.question);
});
