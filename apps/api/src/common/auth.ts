import { createHmac, timingSafeEqual } from 'node:crypto';

export type Rol = 'cliente' | 'tienda' | 'repartidor' | 'admin';

export interface AuthUser {
  id: string;
  rol: Rol;
  /** Tienda que atiende el personal de tienda; null para clientes y admin. */
  ubicacionId: string | null;
}

export function authSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET es obligatorio en producción');
  return 'dev-secret-NO-USAR-EN-PRODUCCION';
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** Token firmado con HMAC-SHA256 (provisional: se reemplaza por autenticación real en los acabados). */
export function signToken(user: AuthUser, ttlSeconds = 60 * 60 * 12, now = Date.now()): string {
  const payload = b64(JSON.stringify({ ...user, exp: Math.floor(now / 1000) + ttlSeconds }));
  const sig = createHmac('sha256', authSecret()).update(payload).digest();
  return `${payload}.${b64(sig)}`;
}

export function verifyToken(token: string, now = Date.now()): AuthUser | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', authSecret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as AuthUser & { exp: number };
    if (data.exp * 1000 < now) return null;
    return { id: data.id, rol: data.rol, ubicacionId: data.ubicacionId ?? null };
  } catch {
    return null;
  }
}
