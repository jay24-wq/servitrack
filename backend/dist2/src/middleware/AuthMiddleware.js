import jwt from 'jsonwebtoken';
import db from '@models/index';
/**
 * Middleware Autentikasi JWT:
 * 1. Mengekstrak Bearer token dari header Authorization.
 * 2. Memverifikasi signature JWT.
 * 3. Menempelkan payload { user_id, email, role, tenant_id } ke req.user.
 */
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Akses ditolak - Token tidak ditemukan' });
        return;
    }
    const token = authHeader.substring(7);
    try {
        const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: 'Akses ditolak - Token tidak valid atau kedaluwarsa' });
    }
}
/**
 * Helper decorator / hook untuk query RLS Knex:
 * Menetapkan sesi `app.tenant_id` pada transaksi Knex sebelum mengeksekusi query.
 */
export async function withTenantContext(tenant_id, callback) {
    return db.transaction(async (trx) => {
        await trx.raw('SELECT set_config(?, ?, true)', ['app.tenant_id', tenant_id]);
        return callback(trx);
    });
}
//# sourceMappingURL=AuthMiddleware.js.map