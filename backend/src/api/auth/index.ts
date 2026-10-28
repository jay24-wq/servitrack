import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '@models/index';
import { authMiddleware, AuthRequest } from '@middleware/AuthMiddleware';
import { ensureBookingSlots } from '@services/bookingSlotService';
import { appConfig } from '@config/app';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Pendaftaran Tenant & Admin baru.
 * Dijalankan dalam transaksi database:
 * 1. Buat Tenant
 * 2. Buat Cabang Utama
 * 3. Buat User Admin
 * 4. Buat Langganan Starter default
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { tenant_name, slug, owner_name, phone, email, password } = req.body;

    if (!tenant_name || !slug || !owner_name || !phone || !email || !password) {
      res.status(400).json({ error: 'Semua field (tenant_name, slug, owner_name, phone, email, password) wajib diisi' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await db.transaction(async (trx) => {
      const newTenantId = uuidv4();
      await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [newTenantId]);

      const adminRole = await trx('roles').where({ code: 'admin' }).first();
      if (!adminRole) {
        throw new Error('Role admin tidak ditemukan dalam sistem');
      }

      const starterPlan = await trx('plans').where({ code: 'starter' }).first();

      const [tenant] = await trx('tenants')
        .insert({
          id: newTenantId,
          name: tenant_name,
          slug,
          owner_name,
          phone,
          status: 'active',
        })
        .returning('*');

      // 3. Buat Cabang Utama
      const [branch] = await trx('branches')
        .insert({
          tenant_id: tenant.id,
          name: 'Cabang Utama',
          is_main: true,
          is_active: true,
        })
        .returning('*');

      await ensureBookingSlots(trx, tenant.id, branch.id);

      // 4. Buat User Admin
      const [user] = await trx('users')
        .insert({
          tenant_id: tenant.id,
          branch_id: branch.id,
          role_id: adminRole.id,
          name: owner_name,
          email,
          password_hash,
          is_active: true,
        })
        .returning('*');

      // 5. Buat Langganan Starter jika plan ada
      if (starterPlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30);

        await trx('subscriptions').insert({
          tenant_id: tenant.id,
          plan_id: starterPlan.id,
          status: 'active',
          period_start: startDate,
          period_end: endDate,
        });
      }

      return { tenant, branch, user };
    });

    res.status(201).json({
      message: 'Registrasi tenant dan admin berhasil',
      data: {
        tenant_id: result.tenant.id,
        tenant_name: result.tenant.name,
        slug: result.tenant.slug,
        user_id: result.user.id,
        email: result.user.email,
      },
    });
  } catch (error: any) {
    if (error.code === '23505') { // PostgreSQL unique_violation
      res.status(409).json({ error: 'Slug toko atau Email sudah terdaftar' });
      return;
    }
    res.status(500).json({ error: error.message || 'Gagal melakukan registrasi' });
  }
});

/**
 * GET /api/auth/me
 * Mengembalikan identitas dari token. Contoh pemakaian authMiddleware:
 * payload inilah yang nantinya dijadikan konteks tenant untuk RLS.
 */
authRouter.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/login
 * Login pengguna dengan Email dan Password.
 * Menghasilkan JWT token berisi user_id, email, role, dan tenant_id.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, slug } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi' });
      return;
    }

    let tenantIdFromSlug: string | null = null;
    if (slug) {
      try {
        const r = await db.raw("SELECT resolve_tenant_by_slug(?) as id", [slug]);
        tenantIdFromSlug = r.rows?.[0]?.id || null;
      } catch (e) {
        const r2 = await db('tenants').where({ slug }).first();
        tenantIdFromSlug = r2?.id || null;
      }
      if (!tenantIdFromSlug) {
        res.status(401).json({ error: 'Email atau password salah' });
        return;
      }
    }

    const user = await db.transaction(async (trx) => {
      if (tenantIdFromSlug) {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantIdFromSlug]);
      }
      let q = trx('users')
        .join('roles', 'users.role_id', 'roles.id')
        .join('tenants', 'users.tenant_id', 'tenants.id')
        .leftJoin('subscriptions', 'subscriptions.tenant_id', 'users.tenant_id')
        .leftJoin('plans', 'subscriptions.plan_id', 'plans.id')
        .where({ 'users.email': email, 'users.is_active': true })
        .whereNull('users.deleted_at')
        .where(function (this: any) {
          this.where('subscriptions.status', 'active').orWhereNull('subscriptions.id');
        })
        .select(
          'users.id as user_id',
          'users.name as name',
          'users.email',
          'users.password_hash',
          'users.tenant_id',
          'users.branch_id as branch_id',
          'roles.code as role',
          'tenants.status as tenant_status',
          'tenants.slug as tenant_slug',
          'plans.code as plan_code'
        )
        .orderByRaw('subscriptions.period_end DESC NULLS LAST')
        .first();
      return q;
    });

    if (!user) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    if (user.tenant_status === 'suspended') {
      res.status(403).json({ error: 'Akses ditangguhkan. Silakan hubungi dukungan' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    await db('users').where({ id: user.user_id }).update({ last_login_at: new Date() });

    // JWT Payload dengan tenant_id secara eksplisit
    const payload = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
      branch_id: user.branch_id || undefined,
      plan: user.plan_code || undefined,
    };

    const token = jwt.sign(payload, appConfig.jwtSecret, { expiresIn: '24h' });

    res.json({
      message: 'Login berhasil',
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        branch_id: user.branch_id || null,
        plan: user.plan_code || undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal melakukan login' });
  }
});
