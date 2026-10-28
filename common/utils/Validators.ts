import { z } from 'zod';

export const emailSchema = z.string().email('Format email tidak valid');
export const phoneSchema = z.string().min(10, 'Nomor telepon minimal 10 digit').max(15, 'Nomor telepon maksimal 15 digit');
export const passwordSchema = z.string().min(8, 'Password minimal 8 karakter');

export const ticketStatusSchema = z.enum(['ANTRIAN', 'PENGECEKAN', 'MENUNGGU_PART', 'PENGGERJAAN', 'QUALITY_CHECK', 'SELESAI', 'SIAP_DIAMBIL']);

export const planNameSchema = z.enum(['STARTER', 'PRO', 'ADVANCE']);

export const paymentMethodSchema = z.enum(['TUNAI', 'QRIS', 'VIRTUAL_ACCOUNT', 'EWALLET']);
export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'REFUNDED']);

export const bookingStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']);
