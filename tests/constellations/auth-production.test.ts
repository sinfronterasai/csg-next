import jwt from 'jsonwebtoken';
import { generateToken, hasSecureJwtConfiguration, verifyToken } from '@/lib/auth';

describe('Navigator production authentication configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  it('cannot authenticate with the documented development fallback when production JWT_SECRET is absent', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    const forged = jwt.sign({ userId: '7' }, 'dev-insecure-secret-change-me');
    expect(hasSecureJwtConfiguration()).toBe(false);
    expect(verifyToken(forged)).toBeNull();
    expect(() => generateToken('7')).toThrow(/JWT_SECRET/);
  });
});
