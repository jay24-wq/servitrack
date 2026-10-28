import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '@models/index';

export interface UserPayload {
  user_id: string;
  name?: string;
  email: string;
  role: string;
  tenant_id: string;
  /** ID cabang aktif user (diisi bila di-embed saat login) */
  branch_id?: string;
  /** Kode paket langganan (opsional, diisi bila di-embed saat login) */
  plan?: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
  db?: import('knex').Knex.Transaction;
}

/**
 * Middleware Autentikasi JWT:
 * 1. Mengekstrak Bearer token dari header Authorization.
 * 2. Memverifikasi signature JWT.
 * 3. Menempelkan payload { user_id, email, role, tenant_id } ke req.user.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Akses ditolak - Token tidak ditemukan' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
    const decoded = jwt.verify(token, secret) as UserPayload;

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Akses ditolak - Token tidak valid atau kedaluwarsa' });
  }
}

/**
 * Middleware otorisasi berbasis role.
 * Role dari JWT disimpan lowercase (mis. "admin"), tetapi pembandingan
 * dibuat case-insensitive agar payload dari sumber lain tetap aman.
 */
export function requireRole(...allowedRoles: string[]) {
  const allowed = new Set(allowedRoles.map((role) => role.trim().toLowerCase()));

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role?.trim().toLowerCase();

    if (!role) {
      res.status(401).json({ error: 'Akses ditolak - Identitas pengguna tidak ditemukan' });
      return;
    }

    if (!allowed.has(role)) {
      res.status(403).json({ error: 'Akses ditolak - Role tidak memiliki izin' });
      return;
    }

    next();
  };
}

/**
 * Helper decorator / hook untuk query RLS Knex:
 * Menetapkan sesi `app.tenant_id` pada transaksi Knex sebelum mengeksekusi query.
 */
export async function withTenantContext<T>(
  tenant_id: string,
  callback: (trx: import('knex').Knex.Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (trx) => {
    await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
    return callback(trx);
  });
}
