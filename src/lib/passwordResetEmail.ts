import { PASSWORD_RESET_FROM } from '@/lib/passwordReset';

export async function sendPasswordResetEmail(to: string, resetUrl: string, idempotencyKey: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is required for password reset email');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: PASSWORD_RESET_FROM,
      to: [to],
      subject: 'Reset your Cosmic Spirit Guide password',
      text: [
        'A password reset was requested for your Cosmic Spirit Guide account.',
        '',
        `Use this link to reset your password: ${resetUrl}`,
        '',
        'This link expires in 30 minutes.',
        'If you did not request a password reset, you can ignore this email.',
      ].join('\n'),
      html: [
        '<p>A password reset was requested for your Cosmic Spirit Guide account.</p>',
        `<p><a href="${resetUrl}">Reset your password</a></p>`,
        '<p>This link expires in 30 minutes.</p>',
        '<p>If you did not request a password reset, you can ignore this email.</p>',
      ].join(''),
    }),
  });

  if (!response.ok) {
    throw new Error(`Password reset email provider returned HTTP ${response.status}`);
  }
}
