import { createHmac } from 'node:crypto';
import { offerForPlan, resolveWhopPlanId } from '@/lib/whop';
import { verifyWhopSignature } from '@/lib/whopSignature';

describe('Whop payment integration', () => {
  test('maps every supplied plan to its offer', () => {
    expect(offerForPlan('plan_oazEpfS5z5Gud')).toBe('premium_natal_report');
    expect(offerForPlan('plan_CCmKCXfGGPpvo')).toBe('love_blueprint');
    expect(offerForPlan('plan_yspM7Upl5CsPM')).toBe('yearly_transit_forecast');
    expect(offerForPlan('plan_uk5Oa0Ck3Xfku')).toBe('celtic_cross');
    expect(offerForPlan('plan_FojHN8WK5oMKA')).toBe('relationship_dynamics');
    expect(offerForPlan('plan_Z15jdqRtkKdrS')).toBe('career_crossroads');
    expect(offerForPlan('plan_unknown')).toBeNull();
  });

  test('prefers payment plan_id and falls back to line items', () => {
    expect(resolveWhopPlanId({ plan_id: 'plan_a', line_items: [{ plan_id: 'plan_b' }] })).toBe('plan_a');
    expect(resolveWhopPlanId({ line_items: [{ plan_id: 'plan_b' }] })).toBe('plan_b');
  });

  test('verifies the raw-body signature and rejects tampering', () => {
    const secret = 'test-secret';
    const rawBody = '{"type":"payment.succeeded"}';
    const id = 'msg_test';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac('sha256', secret).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
    const headers = new Headers({
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${signature}`,
    });

    expect(() => verifyWhopSignature(rawBody, headers, secret)).not.toThrow();
    expect(() => verifyWhopSignature(`${rawBody} `, headers, secret)).toThrow('Invalid webhook signature');
  });
});
