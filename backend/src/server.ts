// Harus paling atas supaya process.env terisi sebelum config database dievaluasi
import 'dotenv/config';

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { authRouter } from '@api/auth';
import { branchRouter } from '@api/branches';
import { staffRouter } from '@api/staff';
import { customerRouter } from './api/customers';
import { bookingRouter } from './api/bookings';
import { ticketRouter } from './api/tickets';
import { inventoryRouter } from './api/inventory';
import { quotationRouter } from './api/quotations';
import { partsUsageRouter } from './api/parts-usage';
import { invoiceRouter } from './api/invoices';
import { paymentRouter } from './api/payments';
import { tenantProfileRouter } from '@api/tenant-profile';
import { dashboardRouter } from './api/dashboard';
import { reportsRouter } from './api/reports';
import { publicRouter } from '@api/public';
import { trackingRouter } from '@api/tracking';
import { notificationRouter } from '@api/notifications';
import { bookingCalendarRouter } from './api/booking-calendar';
import { courierRouter } from './api/courier';
import { whatsappRouter } from './api/whatsapp';
import { midtransWebhookRouter } from './api/webhooks/midtrans';
import { validateMidtransEnvironment } from '@services/payments/MidtransGateway';
import { assertOsrmConfiguration } from '@services/osrmRouting';
import path from 'node:path';
import { startAvailabilityScheduler, startQuotationScheduler } from './jobs/index';

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Routes
app.use('/api/public', publicRouter);
app.use('/api/tracking', trackingRouter);
app.use('/api/webhooks/midtrans', midtransWebhookRouter);
app.use('/api/auth', authRouter);
app.use('/api/branches', branchRouter);
app.use('/api/staff', staffRouter);
app.use('/api/customers', customerRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/quotations', quotationRouter);
app.use('/api/parts-usage', partsUsageRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/tenant', tenantProfileRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/booking-calendar', bookingCalendarRouter);
app.use('/api/courier', courierRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

async function assertNonSuperuser() {
  try {
    const r = await (await import('@models/index')).default.raw(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
    );
    const { rolsuper, rolbypassrls } = r.rows[0] || {};
    if (rolsuper || rolbypassrls) {
      console.error('FATAL: koneksi app tidak boleh superuser/BYPASSRLS');
      process.exit(1);
    }
  } catch (e) {
    console.warn('Warning: tidak bisa cek rolsuper/rolbypassrls', (e as any)?.message);
  }
}

async function assertSchemaReady() {
  const required = [
    'service_tickets.work_type',
    'service_tickets.diagnosis_status',
    'service_tickets.technician_diagnosis',
    'service_tickets.additional_damage',
    'service_tickets.requested_part_id',
    'service_tickets.requested_part_qty',
    'service_tickets.workflow_resolution',
    'service_tickets.cancelled_at',
    'service_tickets.service_fee',
    'service_tickets.diagnostic_fee',
    'service_tickets.part_shortages',
    'quotations.approval_token_hash',
    'quotations.technician_diagnosis_snapshot',
    'quotations.last_reminder_at',
    'quotation_items.availability_status',
    'quotation_items.estimated_part_arrival_days',
    'quotation_items.part_name_snapshot',
    'quotation_items.part_is_registered',
    'part_requests.status',
    'part_requests.quotation_item_id',
    'part_requests.linked_part_id',
    'part_requests.estimated_arrival_days',
    'part_stock_movements.reversal_of_movement_id',
    'audit_logs.user_agent',
    'tenant_notification_settings.openwa_session_id',
    'tenant_notification_settings.openwa_session_status',
    'tenant_notification_settings.openwa_connected_phone',
    'tenant_notification_settings.openwa_verified_at',
    'notification_logs.notification_type',
    'invoices.line_items',
    'payments.order_id',
    'payments.is_full_settlement',
    'payments.gateway_payment_type',
    'payment_gateway_webhook_logs.payload',
    'tenant_payment_settings.bank_account_number',
    'service_tickets.handed_over_at',
  ];
  try {
    const r = await (await import('@models/index')).default.raw(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('service_tickets', 'quotations', 'quotation_items', 'part_stock_movements', 'part_requests', 'audit_logs', 'tenant_notification_settings', 'notification_logs', 'invoices', 'payments', 'payment_gateway_webhook_logs', 'tenant_payment_settings')"
    );
    const present = new Set((r.rows as Array<{ table_name: string; column_name: string }>).map((row) => `${row.table_name}.${row.column_name}`));
    const missing = required.filter((column) => !present.has(column));
    if (missing.length > 0) {
      console.error(`FATAL: migrasi database belum lengkap. Kolom workflow hilang: ${missing.join(', ')}`);
      console.error('Jalankan: npm run db:migrate');
      process.exit(1);
    }
  } catch (e) {
    console.error('FATAL: gagal memeriksa skema database', (e as any)?.message);
    process.exit(1);
  }
}

let _server: any = null;
function startServer() {
  if (_server) return _server;
  const doListen = () =>
    app.listen(PORT, () => {
      console.log(`[Backend] Server running on port ${PORT}`);
      console.log(`[Backend] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Backend] Health check: http://localhost:${PORT}/health`);
    });
  if (process.env.NODE_ENV !== 'test') {
    try {
      assertOsrmConfiguration();
    } catch (error) {
      console.error('FATAL: konfigurasi OSRM tidak valid', (error as Error).message);
      process.exit(1);
    }
    try {
      validateMidtransEnvironment();
    } catch (error) {
      console.error('FATAL: konfigurasi Midtrans tidak valid', (error as Error).message);
      process.exit(1);
    }
    Promise.all([assertNonSuperuser(), assertSchemaReady()]).then(() => {
      _server = doListen();
      startAvailabilityScheduler();
      startQuotationScheduler();
    });
  } else {
    _server = doListen();
  }
  return _server;
}
if (!process.env.VITEST) startServer();

export default app;
