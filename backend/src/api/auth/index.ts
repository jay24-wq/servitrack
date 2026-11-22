import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '@models/index';
import { authMiddleware, AuthRequest, withTenantContext } from '@middleware/AuthMiddleware';
import { ensureBookingSlots } from '@services/bookingSlotService';
import { appConfig } from '@config/app';
import { getPortalRoleError, type LoginPortal } from './loginPolicy';
import { logAudit } from '@services/auditLog';

export const authRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^628[1-9]\d{7,11}$/;
const ACCOUNT_TIME_ZONES = new Set(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC']);

async function loadAccountProfile(
  trx: import('knex').Knex,
  userId: string,
  tenantId: string,
  selectedBranchId?: string,
) {
  const user = await trx('users')
    .join('roles', 'users.role_id', 'roles.id')
    .join('tenants', 'users.tenant_id', 'tenants.id')
    .where({ 'users.id': userId, 'users.tenant_id': tenantId, 'users.is_active': true })
    .whereNull('users.deleted_at')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.branch_id',
      'users.avatar_data_url',
      'users.time_zone',
      'users.created_at',
      'users.last_login_at',
      'roles.code as role',
      'tenants.name as tenant_name',
      'tenants.address as tenant_address',
    )
    .first();

  if (!user) return null;

  const branchId = user.role === 'admin' ? selectedBranchId || user.branch_id : user.branch_id;
  const branch = branchId
    ? await trx('branches').where({ id: branchId, tenant_id: tenantId, is_active: true }).select('id', 'name').first()
    : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role).toUpperCase(),
    tenant_id: tenantId,
    branch_id: user.branch_id,
    active_branch_id: branch?.id ?? null,
    active_branch_name: branch?.name ?? null,
    tenant_name: user.tenant_name,
    tenant_address: user.tenant_address ?? null,
    avatar_data_url: user.avatar_data_url,
    time_zone: user.time_zone || 'Asia/Jakarta',
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  };
}

function normalizeIndonesianPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
}

function createTenantSlug(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42)
    .replace(/-+$/g, '') || 'workshop';
  return `${base}-${uuidv4().slice(0, 8)}`;
}

function parseCoordinate(value: unknown): number {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
}

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
    const tenant_name = String(req.body.tenant_name || '').trim();
    const owner_name = String(req.body.owner_name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phone = normalizeIndonesianPhone(String(req.body.phone || ''));
    const address = String(req.body.address || '').trim();
    const latitude = parseCoordinate(req.body.latitude);
    const longitude = parseCoordinate(req.body.longitude);
    const requestedSlug = String(req.body.slug || '').trim().toLowerCase();
    const slug = requestedSlug || createTenantSlug(tenant_name);
    const logoDataUrl = typeof req.body.logo_data_url === 'string' ? req.body.logo_data_url : null;

    if (!tenant_name || !owner_name || !email || !password || !phone || !address) {
      res.status(400).json({ error: 'Data akun, bengkel, nomor WhatsApp, dan lokasi wajib diisi' });
      return;
    }
    if (tenant_name.length > 120 || owner_name.length > 100 || email.length > 150 || address.length > 500) {
      res.status(400).json({ error: 'Ada data yang melebihi batas panjang yang diizinkan' });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      res.status(400).json({ error: 'Alamat email tidak valid' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password minimal 8 karakter' });
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      res.status(400).json({ error: 'Nomor WhatsApp harus menggunakan nomor seluler Indonesia yang valid' });
      return;
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      res.status(400).json({ error: 'Lokasi workshop belum valid. Pilih titik lokasi pada peta.' });
      return;
    }
    if (slug.length > 60 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      res.status(400).json({ error: 'ID workshop tidak valid' });
      return;
    }
    if (logoDataUrl && (logoDataUrl.length > 70000 || !/^data:image\/(?:webp|png|jpeg);base64,[a-z\d+/]+={0,2}$/i.test(logoDataUrl))) {
      res.status(400).json({ error: 'Logo harus berupa PNG, JPG, atau WebP dengan ukuran hasil kompresi maksimal 70 KB' });
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
          email,
          address,
          latitude,
          longitude,
          logo_data_url: logoDataUrl,
          status: 'active',
        })
        .returning('*');

      await trx('tenant_notification_settings').insert({ tenant_id: tenant.id });

      // 3. Buat Cabang Utama
      const [branch] = await trx('branches')
        .insert({
          tenant_id: tenant.id,
          name: 'Cabang Utama',
          address,
          phone,
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
          phone,
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

      return { tenant, branch, user, role: adminRole.code, plan_code: starterPlan?.code || 'starter' };
    });

    const token = jwt.sign({
      user_id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.role,
      tenant_id: result.tenant.id,
      branch_id: result.branch.id,
      plan: result.plan_code,
    }, appConfig.jwtSecret, { expiresIn: '24h' });

    res.status(201).json({
      message: 'Registrasi tenant dan admin berhasil',
      token,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.role,
        tenant_id: result.tenant.id,
        branch_id: result.branch.id,
        plan: result.plan_code,
      },
      data: {
        tenant_id: result.tenant.id,
        tenant_name: result.tenant.name,
        slug: result.tenant.slug,
        user_id: result.user.id,
        email: result.user.email,
        address: result.tenant.address,
        latitude: result.tenant.latitude,
        longitude: result.tenant.longitude,
      },
    });
  } catch (error: any) {
    if (error.code === '23505') { // PostgreSQL unique_violation
      const message = error.constraint === 'uq_users_tenant_email'
        ? 'Email sudah terdaftar. Gunakan email lain atau masuk ke akun Anda.'
        : 'ID workshop sedang digunakan. Silakan coba lagi.';
      res.status(409).json({ error: message });
      return;
    }
    res.status(500).json({ error: error.message || 'Gagal melakukan registrasi' });
  }
});

/** GET /api/auth/me - data profil dan informasi akun pengguna aktif. */
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const tenantId = req.user?.tenant_id;
    if (!userId || !tenantId) return res.status(401).json({ error: 'Identitas pengguna tidak ditemukan' });

    const user = await withTenantContext(tenantId, (trx) =>
      loadAccountProfile(trx, userId, tenantId, req.get('x-branch-id')),
    );
    if (!user) return res.status(404).json({ error: 'Akun tidak ditemukan atau tidak aktif' });
    return res.json({ user: { ...user, plan: req.user?.plan } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal mengambil profil akun' });
  }
});

/** PUT /api/auth/me - memperbarui profil dan/atau password akun sendiri. */
authRouter.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.user_id;
    const tenantId = req.user?.tenant_id;
    if (!userId || !tenantId) return res.status(401).json({ error: 'Identitas pengguna tidak ditemukan' });

    const body = req.body ?? {};
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) {
        return res.status(400).json({ error: 'Nama lengkap wajib diisi dan maksimal 100 karakter' });
      }
      updateData.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== 'string') return res.status(400).json({ error: 'Email tidak valid' });
      const email = body.email.trim().toLowerCase();
      if (email.length > 150 || !EMAIL_PATTERN.test(email)) return res.status(400).json({ error: 'Format email tidak valid' });
      updateData.email = email;
    }
    if (body.avatar_data_url !== undefined) {
      if (body.avatar_data_url !== null && (
        typeof body.avatar_data_url !== 'string' ||
        body.avatar_data_url.length > 70000 ||
        !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.avatar_data_url)
      )) {
        return res.status(400).json({ error: 'Foto profil harus berupa WebP yang valid dan maksimal 70 KB' });
      }
      updateData.avatar_data_url = body.avatar_data_url;
    }
    if (body.time_zone !== undefined) {
      if (typeof body.time_zone !== 'string' || !ACCOUNT_TIME_ZONES.has(body.time_zone)) {
        return res.status(400).json({ error: 'Zona waktu tidak valid' });
      }
      updateData.time_zone = body.time_zone;
    }

    const changingPassword = body.current_password !== undefined || body.new_password !== undefined;
    if (changingPassword && (
      typeof body.current_password !== 'string' || !body.current_password ||
      typeof body.new_password !== 'string' || body.new_password.length < 8
    )) {
      return res.status(400).json({ error: 'Password saat ini wajib diisi dan password baru minimal 8 karakter' });
    }

    if (!Object.keys(updateData).length && !changingPassword) {
      return res.status(400).json({ error: 'Tidak ada perubahan untuk disimpan' });
    }

    const result = await withTenantContext(tenantId, async (trx) => {
      const before = await trx('users')
        .where({ id: userId, tenant_id: tenantId, is_active: true })
        .whereNull('deleted_at')
        .select('name', 'email', 'time_zone', 'avatar_data_url')
        .first();
      if (!before) return { error: 'not_found' as const };

      if (changingPassword) {
        const current = await trx('users')
          .where({ id: userId, tenant_id: tenantId, is_active: true })
          .whereNull('deleted_at')
          .select('password_hash')
          .first();
        if (!current) return { error: 'not_found' as const };
        if (!await bcrypt.compare(body.current_password, current.password_hash)) return { error: 'incorrect_password' as const };
        updateData.password_hash = await bcrypt.hash(body.new_password, 10);
      }

      await trx('users')
        .where({ id: userId, tenant_id: tenantId, is_active: true })
        .whereNull('deleted_at')
        .update({ ...updateData, updated_at: trx.fn.now() });

      const user = await loadAccountProfile(trx, userId, tenantId, req.get('x-branch-id'));
      if (!user) return { error: 'not_found' as const };
      await logAudit(trx, req, {
        action: 'settings.account_updated',
        entityType: 'user_settings',
        entityId: userId,
        oldValues: { name: before.name, email: before.email, time_zone: before.time_zone || 'Asia/Jakarta', avatar_configured: Boolean(before.avatar_data_url) },
        newValues: { name: user.name, email: user.email, time_zone: user.time_zone, avatar_configured: Boolean(user.avatar_data_url), avatar_changed: updateData.avatar_data_url !== undefined, password_changed: changingPassword },
      });
      return { user };
    });

    if ('error' in result) {
      const status = result.error === 'incorrect_password' ? 400 : 404;
      const message = result.error === 'incorrect_password' ? 'Password saat ini tidak sesuai' : 'Akun tidak ditemukan atau tidak aktif';
      return res.status(status).json({ error: message });
    }
    return res.json({ message: 'Profil akun berhasil diperbarui', user: { ...result.user, plan: req.user?.plan } });
  } catch (error: any) {
    if (error.code === '23505') return res.status(409).json({ error: 'Email sudah digunakan di tenant ini' });
    return res.status(500).json({ error: error.message || 'Gagal memperbarui profil akun' });
  }
});

authRouter.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.user_id || !req.user.tenant_id) return res.status(401).json({ error: 'Identitas pengguna tidak ditemukan' });
    const result = await withTenantContext(req.user.tenant_id, async (trx) => {
      const before = await trx('users').where({ id: req.user!.user_id, tenant_id: req.user!.tenant_id }).select('id', 'courier_status').first();
      const affectedRows = await trx('users').where({ id: req.user!.user_id, tenant_id: req.user!.tenant_id }).update({ courier_status: 'OFFLINE', updated_at: trx.fn.now() });
      const after = await trx('users').where({ id: req.user!.user_id, tenant_id: req.user!.tenant_id }).select('id', 'courier_status').first();
      return { before, after, affectedRows };
    });
    console.info('[Auth] logout availability', { userId: req.user.user_id, before: result.before?.courier_status ?? null, after: result.after?.courier_status ?? null, affectedRows: result.affectedRows });
    if (result.affectedRows !== 1 || result.after?.courier_status !== 'OFFLINE') return res.status(409).json({ error: 'Status availability gagal diubah menjadi OFFLINE' });
    return res.json({ message: 'Logout berhasil', data: { status: result.after.courier_status, affectedRows: result.affectedRows } });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Gagal logout' });
  }
});

/**
 * POST /api/auth/login
 * Login pengguna dengan Email dan Password.
 * Menghasilkan JWT token berisi user_id, email, role, dan tenant_id.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    // Optional for legacy clients; new login forms identify accounts by email and password.
    const slug = req.body.slug ? String(req.body.slug).trim().toLowerCase() : undefined;
    const portal = String(req.body.portal || 'admin').trim().toLowerCase();

    if (portal !== 'admin' && portal !== 'staff') {
      res.status(400).json({ error: 'Portal login tidak valid' });
      return;
    }

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi' });
      return;
    }

    let tenantIds: string[];
    if (slug) {
      let tenantIdFromSlug: string | null = null;
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
      tenantIds = [tenantIdFromSlug];
    } else {
      const result = await db.raw(
        'SELECT tenant_id FROM public.resolve_tenant_ids_by_email(?)',
        [email]
      );
      tenantIds = [...new Set((result.rows as Array<{ tenant_id: string }>).map((row) => row.tenant_id))];
    }

    const matchingUsers = [];
    for (const tenantId of tenantIds) {
      const candidate = await db.transaction(async (trx) => {
        await trx.raw("SELECT set_config('app.tenant_id', ?, true)", [tenantId]);
        return trx('users')
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
            'plans.code as plan_code'
          )
          .orderByRaw('subscriptions.period_end DESC NULLS LAST')
          .first();
      });

      if (candidate && await bcrypt.compare(password, candidate.password_hash)) {
        matchingUsers.push(candidate);
      }
    }

    // An email can exist in more than one tenant. Never select a tenant arbitrarily.
    if (matchingUsers.length !== 1) {
      res.status(401).json({ error: 'Email atau password salah' });
      return;
    }

    const user = matchingUsers[0];

    if (user.tenant_status === 'suspended') {
      res.status(403).json({ error: 'Akses ditangguhkan. Silakan hubungi dukungan' });
      return;
    }

    const portalError = getPortalRoleError(portal as LoginPortal, user.role);
    if (portalError) {
      res.status(403).json({ error: portalError });
      return;
    }

    await withTenantContext(user.tenant_id, async (trx) => {
      await trx('users').where({ id: user.user_id, tenant_id: user.tenant_id }).update({ last_login_at: new Date(), courier_status: 'ONLINE' });
    });

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
