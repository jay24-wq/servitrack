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
    // Jangan lanjutkan request tenant tanpa transaksi yang memuat app.tenant_id.
    return next(new Error('Gagal menyiapkan konteks tenant'));
  }
  next();
}

/** Helper safe untuk router: pakai transaksi request bila ada. */
export function reqDb(req: AuthRequest) {
  if (req.user?.tenant_id && !req.db) {
    throw new Error('Konteks database tenant tidak tersedia');
  }
  return req.db ?? db;
}
