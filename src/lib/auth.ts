import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const TOKEN_TTL = '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: TOKEN_TTL as any });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function createUser(opts: { email: string; password: string; firstName?: string; lastName?: string; }) {
  const normalizedEmail = opts.email.toLowerCase().trim();
  const hashed = await hashPassword(opts.password);
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, first_name, last_name, role, created_at`,
    [normalizedEmail, hashed, opts.firstName || null, opts.lastName || null],
  );
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const { rows } = await query(
    `SELECT id, email, password_hash AS password, first_name, last_name, role, created_at
     FROM users WHERE LOWER(email) = $1`,
    [normalizedEmail],
  );
  return rows[0];
}

export async function getUserById(id: string) {
  const { rows } = await query(
    `SELECT id, email, first_name, last_name, role, created_at
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0];
}
