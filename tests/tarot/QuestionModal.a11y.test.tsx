/** @jest-environment jsdom */
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import QuestionModal from '@/components/tarot/QuestionModal';
import { getSpread } from '@/lib/tarot/spreads';

describe('QuestionModal accessibility', () => {
  const spread = getSpread('past_present_future')!;

  it('moves focus into the dialog on open and closes on Escape', () => {
    const onClose = jest.fn();
    render(<QuestionModal spread={spread} onSubmit={jest.fn()} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('restores focus to the trigger after close', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button onClick={() => setOpen(true)}>trigger</button>
          {open && <QuestionModal spread={spread} onClose={() => setOpen(false)} onSubmit={() => {}} />}
        </div>
      );
    }
    render(<Harness />);
    const trigger = screen.getByText('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByLabelText('Close'));
    // After unmount, focus is restored to the trigger.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('traps Tab focus within the dialog', () => {
    const onClose = jest.fn();
    render(<QuestionModal spread={spread} onSubmit={jest.fn()} onClose={onClose} />);
    const dialog = screen.getByRole('dialog');
    const list = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select'));
    const els = list();
    const first = els[0];
    const last = els[els.length - 1];
    // Tab from last wraps to first
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    // Shift+Tab from first wraps to last
    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
