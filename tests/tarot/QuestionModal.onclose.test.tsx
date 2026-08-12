/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import QuestionModal from '@/components/tarot/QuestionModal';
import { getSpread } from '@/lib/tarot/spreads';

describe('QuestionModal onClose stability', () => {
  const spread = getSpread('past_present_future')!;

  it('runs the focus effect once per mount, not on every onClose identity change', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const [n, setN] = useState(0);
      return (
        <div>
          <button onClick={() => setOpen(true)}>open</button>
          <button onClick={() => setN((x) => x + 1)}>rerender</button>
          {open && <QuestionModal spread={spread} onClose={() => setOpen(false)} onSubmit={() => {}} />}
        </div>
      );
    }
    // Spy on focus so we can count effect-driven focus() calls (open moves focus in).
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function () {});
    render(<Harness />);
    const openBtn = screen.getByText('open');
    openBtn.focus();
    fireEvent.click(openBtn);
    const callsAfterOpen = focusSpy.mock.calls.length;
    expect(callsAfterOpen).toBeGreaterThan(0);
    // Parent re-renders with a fresh onClose identity (the reported re-run trigger).
    fireEvent.click(screen.getByText('rerender'));
    const callsAfterRerender = focusSpy.mock.calls.length;
    // Effect must NOT re-run: no new focus() call from the cleanup/restore cycle.
    expect(callsAfterRerender).toBe(callsAfterOpen);
    focusSpy.mockRestore();
  });

  it('still closes via Escape using the latest onClose', () => {
    const onClose = jest.fn();
    const { rerender } = render(<QuestionModal spread={spread} onClose={onClose} onSubmit={jest.fn()} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Re-render with a new onClose identity (should not break Escape).
    const onClose2 = jest.fn();
    rerender(<QuestionModal spread={spread} onClose={onClose2} onSubmit={jest.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
