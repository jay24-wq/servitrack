import { describe, expect, it } from 'vitest';
import { renderWhatsAppTemplate } from '../src/services/notifications/templates';

const trackingCode = 'TKT5560039009';

describe('WhatsApp customer templates', () => {
  it('formats booking and check-in messages with database codes and Indonesian dates', () => {
    const booking = renderWhatsAppTemplate('booking_dropoff_created', {
      trackingCode, queueNumber: 'A-12', bookingDate: '2026-11-22T03:02:00Z',
    });
    expect(booking).toContain('*Booking Servis Berhasil* ✅');
    expect(booking).toContain(`• *Nomor Resi:* ${trackingCode}`);
    expect(booking).toContain('• *Jadwal Booking:* 22 Nov 2026, 10.02 WIB');

    const checkIn = renderWhatsAppTemplate('service_ticket_created', { trackingCode, ticketCode: 'SRV123' });
    expect(checkIn).toContain('*Check-In Servis Berhasil* ✅');
    expect(checkIn).toContain('• *Kode Tiket:* SRV123');
    expect(checkIn).toContain(`• *Nomor Resi:* ${trackingCode}`);
  });

  it('uses customer labels for all service statuses and requires the database tracking code', () => {
    const statuses: Record<string, string> = {
      antrian: 'Masuk Antrean',
      pengecekan: 'Pengecekan',
      menunggu_persetujuan: 'Menunggu Persetujuan Biaya',
      menunggu_part: 'Menunggu Suku Cadang',
      pengerjaan: 'Dalam Pengerjaan',
      quality_check: 'Quality Control',
      selesai: 'Servis Selesai',
      siap_diambil: 'Siap Diambil / Diantar',
      batal: 'Dibatalkan',
    };
    for (const [status, label] of Object.entries(statuses)) {
      const message = renderWhatsAppTemplate('ticket_status_changed', { trackingCode, status });
      expect(message).toContain(`• *Status Saat Ini:* ${label}`);
      expect(message).toContain(`• *Nomor Resi:* ${trackingCode}`);
      expect(message).toMatch(/^\*Pembaruan Status Servis\* 🔧/);
    }
    expect(() => renderWhatsAppTemplate('ticket_status_changed', { status: 'pengerjaan' })).toThrow('tracking_code wajib tersedia');
    expect(() => renderWhatsAppTemplate('ticket_status_changed', {
      trackingCode: '6e5b7cc6-39e9-4029-ba04-811140229946', status: 'pengerjaan',
    })).toThrow('Nomor Resi tidak boleh berupa UUID');
  });

  it('formats payment and quote data as Indonesian customer copy', () => {
    const quote = renderWhatsAppTemplate('quotation_created', {
      trackingCode, ticketCode: 'SRV123', quotationNumber: 'QUO-123',
      complaint: 'Mati total', diagnosis: 'IC charging rusak',
      items: [{ item_type: 'part', part_name_snapshot: 'IC charging', qty: 1, part_cost: 250000, labor_cost: 104000, subtotal: 354000, availability_status: 'TERSEDIA' }],
      totalAmount: 354000, expiresAt: '2026-11-22T03:02:00Z', approvalLink: 'https://example.invalid/approval',
    });
    expect(quote).toContain('• *Nomor Resi:* TKT5560039009');
    expect(quote).toContain('*Total Estimasi:* *Rp 354.000*');
    expect(quote).toContain('Stok: Tersedia');
    expect(quote).not.toContain('TERSEDIA');
    expect(quote).not.toContain('trackingCode:');

    const reminder = renderWhatsAppTemplate('quotation_reminder', {
      trackingCode, ticketCode: 'SRV123', quotationNumber: 'QUO-123', totalAmount: 354000,
      expiresAt: '2026-11-22T03:02:00Z', approvalLink: 'https://example.invalid/approval',
    });
    expect(reminder).toContain(`• *Nomor Resi:* ${trackingCode}`);
    expect(reminder).toContain('*Total Estimasi:* *Rp 354.000*');

    const paid = renderWhatsAppTemplate('payment_received', {
      trackingCode, invoiceNumber: 'INV-123', amount: 354000,
    });
    expect(paid).toContain('• *Total Dibayar:* *Rp 354.000*');
    expect(paid).toContain('• *Status:* *LUNAS*');

    const paymentLink = renderWhatsAppTemplate('payment_link', {
      invoiceNumber: 'INV-123', trackingCode, workshopName: 'Servis Asli',
      totalAmount: 354000, deadline: '2026-11-22T03:02:00Z', paymentLink: 'https://pay.example.invalid/123',
    });
    expect(paymentLink).toContain('*Tagihan Pembayaran Servis* 💳');
    expect(paymentLink).toContain('• *Bengkel:* Servis Asli');
    expect(paymentLink).toContain('• *Batas Pembayaran:* 22 Nov 2026, 10.02 WIB');
    expect(paymentLink).toContain('https://pay.example.invalid/123');

    const instructions = renderWhatsAppTemplate('payment_instruction', {
      invoiceNumber: 'INV-123', trackingCode, workshopName: 'Servis Asli', totalAmount: 354000,
      bankName: 'BCA', bankAccountName: 'Servis Asli', bankAccountNumber: '1234567890',
      qrisUrl: 'https://pay.example.invalid/qris', ewalletProvider: 'OVO', ewalletAccount: '081234567890',
    });
    expect(instructions).toContain('• *Transfer:* BCA a.n. Servis Asli — 1234567890');
    expect(instructions).toContain('• *QRIS:* https://pay.example.invalid/qris');
    expect(instructions).toContain('• *E-Wallet:* OVO 081234567890');
  });

  it.each([
    ['MENUJU_LOKASI', 'Kurir Menuju Lokasi Anda', 'Menuju Lokasi Penjemputan'],
    ['TIBA_DI_LOKASI', 'Kurir Tiba di Lokasi', 'Tiba di Lokasi'],
    ['PERANGKAT_DIJEMPUT', 'Perangkat Berhasil Dijemput', 'Perangkat Dijemput'],
    ['MENUJU_TOKO', 'Perangkat Dalam Perjalanan ke Workshop', 'Menuju Workshop'],
    ['PERANGKAT_TIBA_DI_WORKSHOP', 'Perangkat Tiba di Workshop', 'Tiba di Workshop'],
  ])('uses a customer-friendly pickup label for %s', (status, heading, label) => {
    const message = renderWhatsAppTemplate('courier_pickup', { trackingCode, status });
    expect(message).toContain(`*${heading}*`);
    expect(message).toContain(`• *Status:* ${label}`);
    expect(message).toContain(`• *Nomor Resi:* ${trackingCode}`);
    expect(message).not.toContain(status);
  });

  it.each([
    ['MENUJU_CUSTOMER', 'Kurir Mengantar Perangkat Anda', 'Dalam Perjalanan ke Lokasi Anda'],
    ['SAMPAI_DI_LOKASI', 'Kurir Tiba di Alamat Tujuan', 'Tiba di Lokasi'],
    ['PERANGKAT_DISERAHKAN', 'Perangkat Telah Diserahkan', 'Perangkat Diserahkan'],
    ['SELESAI', 'Pengantaran Selesai', 'Selesai'],
  ])('uses a customer-friendly delivery label for %s', (status, heading, label) => {
    const message = renderWhatsAppTemplate('courier_delivery', { trackingCode, status });
    expect(message).toContain(`*${heading}*`);
    expect(message).toContain(`• *Status:* ${label}`);
    expect(message).toContain(`• *Nomor Resi:* ${trackingCode}`);
    expect(message).not.toContain(status);
  });

  it.each([
    ['CUSTOMER_NOT_HOME', 'Kurir Belum Dapat Menemui Anda'],
    ['WRONG_ADDRESS', 'Alamat Perlu Dikonfirmasi'],
    ['UNREACHABLE', 'Kurir Belum Dapat Menghubungi Anda'],
    ['PICKUP_FAILED', 'Penjemputan Belum Berhasil'],
    ['DELIVERY_FAILED', 'Pengantaran Belum Berhasil'],
  ])('renders courier issue %s without exposing its enum', (status, heading) => {
    const message = renderWhatsAppTemplate('courier_delivery', {
      trackingCode, status,
    });
    expect(message).toContain(`*${heading}* ⚠️`);
    expect(message).toContain(`• *Nomor Resi:* ${trackingCode}`);
    expect(message).not.toContain(status);
    expect(message).not.toContain('failureReason');
  });

  it('uses a friendly reason when a failed courier task has a classified cause', () => {
    const message = renderWhatsAppTemplate('courier_pickup', {
      trackingCode, status: 'PICKUP_FAILED', failureReason: 'WRONG_ADDRESS',
    });
    expect(message).toContain('*Alamat Perlu Dikonfirmasi* ⚠️');
    expect(message).toContain('Silakan hubungi bengkel untuk mengonfirmasi alamat.');
    expect(message).not.toContain('WRONG_ADDRESS');
  });

  it('does not fall back to raw variables for an unknown template', () => {
    expect(() => renderWhatsAppTemplate('unknown_event', { trackingCode })).toThrow('Template WhatsApp tidak dikenal');
  });
});
