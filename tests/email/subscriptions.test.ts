import { buildResultEmail, confirmationToken, normalizeEmail, parseMarketingToken, unsubscribeToken, validEmail } from '@/lib/email/subscriptions';

describe('CSG marketing subscription primitives', () => {
  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(validEmail('person@example.com')).toBe(true);
    expect(validEmail('not-an-email')).toBe(false);
  });

  it('creates verifiable confirmation and unsubscribe tokens without exposing the email in plain text', () => {
    const confirmation = confirmationToken('person@example.com', 'newsletter_form');
    expect(confirmation).not.toContain('person@example.com');
    expect(parseMarketingToken(confirmation, 'confirm')).toMatchObject({ email: 'person@example.com', source: 'newsletter_form' });
    expect(parseMarketingToken(confirmation, 'unsubscribe')).toBeNull();
    expect(parseMarketingToken(unsubscribeToken('person@example.com'), 'unsubscribe')).toMatchObject({ email: 'person@example.com' });
  });

  it('builds a result email with the validated result destination and plain text parity', () => {
    const email = buildResultEmail({ archetype: 'The Reflector', resultUrl: 'https://cosmicspiritguide.com/quizzes/tarot-archetype', language: 'en' });
    expect(email.subject).toContain('The Reflector');
    expect(email.html).toContain('https://cosmicspiritguide.com/quizzes/tarot-archetype');
    expect(email.text).toContain('https://cosmicspiritguide.com/quizzes/tarot-archetype');
  });
});
