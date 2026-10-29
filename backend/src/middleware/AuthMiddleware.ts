import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '@models/index';
import { appConfig } from '@config/app';

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
    const decoded = jwt.verify(token, appConfig.jwtSecret) as UserPayload;

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Akses ditolak - Token tidak valid atau kedaluwarsa' });
  }
}

/** Resolve branch authorization from the database, never from request input. */
export async function branchResolver(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const tenant_id = req.user?.tenant_id;
    const user_id = req.user?.user_id;
    if (!tenant_id || !user_id) {
      res.status(401).json({ error: 'Identitas tenant atau pengguna tidak ditemukan' });
      return;
    }

    const query = req.db ?? db;
    const user = await query('users').where({ id: user_id, tenant_id, is_active: true }).select('branch_id').first();
    if (!user?.branch_id) {
      res.status(403).json({ error: 'Pengguna belum memiliki cabang yang terotorisasi' });
      return;
    }

    const branch = await query('branches').where({ id: user.branch_id, tenant_id, is_active: true }).first();
    if (!branch) {
      res.status(403).json({ error: 'Cabang pengguna tidak aktif atau tidak valid' });
      return;
    }

    req.user!.branch_id = branch.id;
    next();
  } catch {
    res.status(500).json({ error: 'Gagal memvalidasi cabang pengguna' });
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
