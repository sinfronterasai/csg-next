import { readFileSync } from 'fs';
import { join } from 'path';

describe('profile pricing CTA copy', () => {
  const overview = readFileSync(
    join(__dirname, '../../src/components/profile/OverviewTab.tsx'),
    'utf8',
  );
  const account = readFileSync(join(__dirname, '../../src/app/account/page.tsx'), 'utf8');

  it('keeps the free account status separate from one-time tarot purchases', () => {
    expect(overview).toContain('Free Account');
    expect(overview).toContain('One-Time Tarot Readings');
    expect(overview).not.toContain('Free · Upgrade');
  });

  it('does not describe the tarot pricing page as a membership upgrade', () => {
    expect(account).toContain('Explore One-Time Tarot Readings');
    expect(account).not.toContain('Upgrade to Premium');
  });
});
