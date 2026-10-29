import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, branchResolver, requireRole } from '@middleware/AuthMiddleware';
import { tenantResolver, reqDb } from '@middleware/TenantResolver';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);
dashboardRouter.use(requireRole('admin', 'frontdesk'));
dashboardRouter.use(tenantResolver);
dashboardRouter.use(branchResolver);

dashboardRouter.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenant_id = req.user?.tenant_id;
    if (!tenant_id) {
      res.status(401).json({ error: 'Tenant tidak teridentifikasi' });
      return;
    }
    const dbq = reqDb(req);

    const branch = req.user?.branch_id;
    const [ticketNew] = await dbq('service_tickets').where({ tenant_id, branch_id: branch }).where('current_status', 'antrian').count('* as c');
    const [waitingParts] = await dbq('service_tickets').where({ tenant_id, branch_id: branch }).where('current_status', 'menunggu_part').count('* as c');
    const [completedToday] = await dbq('service_tickets').where({ tenant_id, branch_id: branch }).whereIn('current_status', ['selesai', 'siap_diambil']).whereRaw("completed_at::date = current_date").count('* as c');

    const [rev] = await dbq('invoices as i').join('service_tickets as t', 't.id', 'i.ticket_id').where({ 'i.tenant_id': tenant_id, 'i.status': 'paid', 't.branch_id': branch }).whereRaw("i.issued_at >= date_trunc('month', current_date)").sum('i.total as s');
    const revenueMtd = Number(rev?.s) || 0;

    async function trend(days: number) {
      const rowsMasuk = await dbq('service_tickets')
        .where({ tenant_id, branch_id: branch })
        .whereRaw(`created_at >= current_date - interval '${days - 1} days'`)
        .select(dbq.raw("created_at::date as d"))
        .count('* as c')
        .groupByRaw("created_at::date");
      const rowsSelesai = await dbq('service_tickets')
        .where({ tenant_id, branch_id: branch })
        .whereRaw(`completed_at >= current_date - interval '${days - 1} days'`)
        .select(dbq.raw("completed_at::date as d"))
        .count('* as c')
        .groupByRaw("completed_at::date");

      const result: { day: string; masuk: number; selesai: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = date.toISOString().slice(0, 10);
        const label = date.toLocaleDateString('en-US', { weekday: 'short' });
        const m = rowsMasuk.find((r: any) => String(r.d).slice(0, 10) === key);
        const s = rowsSelesai.find((r: any) => String(r.d).slice(0, 10) === key);
        result.push({ day: label, masuk: Number(m?.c) || 0, selesai: Number(s?.c) || 0 });
      }
      return result;
    }

    const trend7 = await trend(7);
    const trend30 = await trend(30);

    const lowStockRow = await dbq('parts')
      .where({ tenant_id, branch_id: branch })
      .whereRaw('stock_qty <= min_stock_qty')
      .select('name', 'stock_qty as remaining', 'min_stock_qty as min')
      .orderBy('stock_qty', 'asc')
      .first();

    const lowStock = lowStockRow
      ? { name: lowStockRow.name, remaining: Number(lowStockRow.remaining), min: Number(lowStockRow.min) }
      : null;

    const technicians = await dbq('users')
      .where({ tenant_id, branch_id: branch, role: 'teknisi', is_active: true })
      .select('id', 'name');

    const bench = [];
    for (const t of technicians.slice(0, 3)) {
      const [agg] = await dbq('service_tickets')
        .where({ tenant_id, branch_id: branch, technician_id: t.id })
        .whereIn('current_status', ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check'])
        .count('* as c');
      bench.push({ name: t.name, status: Number(agg?.c) > 3 ? 'bg-amber-400' : 'bg-emerald-500' });
    }

    const statusLogs = await dbq('ticket_status_logs as l')
      .where('l.tenant_id', tenant_id)
      .where('t.branch_id', branch)
      .leftJoin('service_tickets as t', 't.id', 'l.ticket_id')
      .leftJoin('users as u', 'u.id', 'l.changed_by')
      .select('l.to_status', 'l.created_at', 't.ticket_code', 't.complaint', 'u.name as actor')
      .orderBy('l.created_at', 'desc')
      .limit(3);

    const chipMap: Record<string, { chip: string; tone: string }> = {
      pengecekan: { chip: 'Diagnosa', tone: 'bg-blue-50 text-sky-600 outline-blue-200' },
      pengerjaan: { chip: 'Pengerjaan', tone: 'bg-indigo-50 text-indigo-700 outline-indigo-200' },
      quality_check: { chip: 'QC Passed', tone: 'bg-indigo-50 text-indigo-700 outline-indigo-200' },
      selesai: { chip: 'Selesai', tone: 'bg-emerald-50 text-emerald-700 outline-emerald-200' },
      siap_diambil: { chip: 'Selesai', tone: 'bg-emerald-50 text-emerald-700 outline-emerald-200' },
    };

    const recentLogs = statusLogs.map((l: any) => {
      const info = chipMap[l.to_status] || { chip: l.to_status, tone: 'bg-stone-100 text-stone-600 outline-stone-200' };
      return {
        id: `#${l.ticket_code}`,
        chip: info.chip,
        chipTone: info.tone,
        time: new Date(l.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        title: l.to_status === 'pengecekan' ? 'Pengecekan perangkat' : `Status: ${l.to_status}`,
        device: l.complaint || '-',
        actorInitials: (l.actor || 'FS').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase(),
        actorTone: 'bg-blue-600',
        actor: l.actor || 'Frontdesk',
      };
    });

    const activeTechnicians = technicians.length;
    const activeTickets = await dbq('service_tickets')
      .where({ tenant_id, branch_id: branch })
      .whereIn('current_status', ['antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check'])
      .count('* as c');
    const totalActiveTickets = Number(activeTickets?.[0]?.c) || 0;

    res.json({
      data: {
        ticketNew: Number(ticketNew?.c) || 0,
        waitingParts: Number(waitingParts?.c) || 0,
        completedToday: Number(completedToday?.c) || 0,
        revenueMtd,
        trend7,
        trend30,
        lowStock,
        bench,
        recentLogs: recentLogs.length ? recentLogs : [],
        activeTechnicians,
        totalActiveTickets,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Gagal mengambil dashboard' });
  }
});
