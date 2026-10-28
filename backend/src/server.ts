// Harus paling atas supaya process.env terisi sebelum config database dievaluasi
import 'dotenv/config';

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { authRouter } from '@api/auth';
import { staffRouter } from '@api/staff';
import { customerRouter } from './api/customers';
import { bookingRouter } from './api/bookings';
import { ticketRouter } from './api/tickets';
import { inventoryRouter } from './api/inventory';
import { quotationRouter } from './api/quotations';
import { partsUsageRouter } from './api/parts-usage';
import { invoiceRouter } from './api/invoices';
import { paymentRouter } from './api/payments';
import { dashboardRouter } from './api/dashboard';
import { reportsRouter } from './api/reports';
import { publicRouter } from '@api/public';
import { trackingRouter } from '@api/tracking';
import { notificationRouter } from '@api/notifications';
import { bookingCalendarRouter } from './api/booking-calendar';

const app: Application = express();
const PORT = process.env.PORT || 3000;

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
app.use('/api/auth', authRouter);
app.use('/api/staff', staffRouter);
app.use('/api/customers', customerRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/quotations', quotationRouter);
app.use('/api/parts-usage', partsUsageRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/booking-calendar', bookingCalendarRouter);

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
    assertNonSuperuser().then(() => {
      _server = doListen();
    });
  } else {
    _server = doListen();
  }
  return _server;
}
if (!process.env.VITEST) startServer();

export default app;
