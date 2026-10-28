import type { Request, Response, NextFunction } from 'express';
export interface UserPayload {
    user_id: string;
    name?: string;
    email: string;
    role: string;
    tenant_id: string;
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
export declare function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void;
/**
 * Helper decorator / hook untuk query RLS Knex:
 * Menetapkan sesi `app.tenant_id` pada transaksi Knex sebelum mengeksekusi query.
 */
export declare function withTenantContext<T>(tenant_id: string, callback: (trx: import('knex').Knex.Transaction) => Promise<T>): Promise<T>;
//# sourceMappingURL=AuthMiddleware.d.ts.map