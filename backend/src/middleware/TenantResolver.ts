import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './AuthMiddleware';
import db from '@models/index';

/**
 * Request-scoped RLS context:
 * satu transaksi dipegang selama request, app.tenant_id di-set LOCAL,
 * transaksi di-commit saat response selesai / rollback saat koneksi putus.
 * Router Wajib memakai req.db (bukan `db`) agar RLS berlaku.
 */
export async function tenantResolver(req: AuthRequest, _res: Response, next: NextFunction) {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) return next();

  req.headers['x-tenant-id'] = tenantId;

  try {
    const trx = await db.transaction();
    await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenantId]);
    req.db = trx;

    let done = false;
    const finish = async (commit: boolean) => {
      if (done) return;
      done = true;
      try { commit ? await trx.commit() : await trx.rollback(); } catch { /* already finalized */ }
    };

    _res.on('finish', () => { void finish(true); });
    _res.on('close',  () => { void finish(false); });
  } catch {
    /* tanpa konteks tenant — query akan mengembalikan 0 baris RLS */
  }
  next();
}

/** Helper safe untuk router: pakai transaksi request bila ada. */
export function reqDb(req: AuthRequest) {
  return req.db ?? db;
}