import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './AuthMiddleware';
/**
 * Request-scoped RLS context:
 * satu transaksi dipegang selama request, app.tenant_id di-set LOCAL,
 * transaksi di-commit saat response selesai / rollback saat koneksi putus.
 * Router Wajib memakai req.db (bukan `db`) agar RLS berlaku.
 */
export declare function tenantResolver(req: AuthRequest, _res: Response, next: NextFunction): Promise<void>;
/** Helper safe untuk router: pakai transaksi request bila ada. */
export declare function reqDb(req: AuthRequest): import("knex").Knex<any, unknown[]>;
//# sourceMappingURL=TenantResolver.d.ts.map