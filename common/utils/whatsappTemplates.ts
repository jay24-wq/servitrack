export type WhatsAppVariables = Record<string, unknown>;

export const SERVICE_STATUS_LABELS: Record<string, string> = {
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

const PICKUP_STATUSES: Record<string, { title: string; emoji: string; status: string; description: string }> = {
  MENUJU_LOKASI: {
    title: 'Kurir Menuju Lokasi Anda', emoji: '🛵', status: 'Menuju Lokasi Penjemputan',
    description: 'Kurir kami sedang dalam perjalanan menuju lokasi penjemputan perangkat Anda.',
  },
  TIBA_DI_LOKASI: {
    title: 'Kurir Tiba di Lokasi', emoji: '📍', status: 'Tiba di Lokasi',
    description: 'Kurir kami telah sampai di lokasi penjemputan. Silakan serahkan perangkat Anda kepada kurir kami.',
  },
  PERANGKAT_DIJEMPUT: {
    title: 'Perangkat Berhasil Dijemput', emoji: '📦', status: 'Perangkat Dijemput',
    description: 'Perangkat Anda telah diterima oleh kurir kami dan akan segera dibawa ke workshop.',
  },
  MENUJU_TOKO: {
    title: 'Perangkat Dalam Perjalanan ke Workshop', emoji: '🚚', status: 'Menuju Workshop',
    description: 'Kurir sedang mengantar perangkat Anda menuju workshop kami.',
  },
  PERANGKAT_TIBA_DI_WORKSHOP: {
    title: 'Perangkat Tiba di Workshop', emoji: '🏪', status: 'Tiba di Workshop',
    description: 'Perangkat Anda telah sampai di workshop dengan aman. Tim frontdesk akan segera melakukan check-in.',
  },
};

const DELIVERY_STATUSES: Record<string, { title: string; emoji: string; status: string; description: string }> = {
  MENUJU_CUSTOMER: {
    title: 'Kurir Mengantar Perangkat Anda', emoji: '🛵', status: 'Dalam Perjalanan ke Lokasi Anda',
    description: 'Perangkat Anda sedang dalam perjalanan pengantaran menuju alamat Anda.',
  },
  SAMPAI_DI_LOKASI: {
    title: 'Kurir Tiba di Alamat Tujuan', emoji: '📍', status: 'Tiba di Lokasi',
    description: 'Kurir kami telah tiba di lokasi pengantaran.',
  },
  PERANGKAT_DISERAHKAN: {
    title: 'Perangkat Telah Diserahkan', emoji: '🤝', status: 'Perangkat Diserahkan',
    description: 'Perangkat Anda telah diterima di lokasi tujuan.',
  },
  SELESAI: {
    title: 'Pengantaran Selesai', emoji: '🎉', status: 'Selesai',
    description: 'Terima kasih telah mempercayakan perbaikan perangkat Anda kepada kami!',
  },
};

const COURIER_FAILURES: Record<string, { title: string; status: string; description: string }> = {
  CUSTOMER_NOT_HOME: {
    title: 'Kurir Belum Dapat Menemui Anda', status: 'Perlu Penjadwalan Ulang',
    description: 'Kurir kami belum dapat menemui penerima di lokasi. Silakan hubungi bengkel untuk mengatur jadwal kembali.',
  },
  WRONG_ADDRESS: {
    title: 'Alamat Perlu Dikonfirmasi', status: 'Menunggu Konfirmasi Alamat',
    description: 'Kurir kami mengalami kendala menemukan alamat tujuan. Silakan hubungi bengkel untuk mengonfirmasi alamat.',
  },
  UNREACHABLE: {
    title: 'Kurir Belum Dapat Menghubungi Anda', status: 'Menunggu Konfirmasi',
    description: 'Kurir kami belum berhasil menghubungi Anda. Silakan hubungi bengkel agar proses dapat dilanjutkan.',
  },
  CUSTOMER_CANCELLED: {
    title: 'Jadwal Kurir Dibatalkan', status: 'Dibatalkan',
    description: 'Permintaan kurir telah dibatalkan. Hubungi bengkel jika Anda ingin menjadwalkan layanan kembali.',
  },
  PICKUP_FAILED: {
    title: 'Penjemputan Belum Berhasil', status: 'Penjemputan Tertunda',
    description: 'Penjemputan perangkat belum berhasil dilakukan. Tim bengkel akan membantu mengatur tindak lanjut.',
  },
  DELIVERY_FAILED: {
    title: 'Pengantaran Belum Berhasil', status: 'Pengantaran Tertunda',
    description: 'Pengantaran perangkat belum berhasil dilakukan. Tim bengkel akan membantu mengatur tindak lanjut.',
  },
  OTHER: {
    title: 'Kurir Mengalami Kendala', status: 'Menunggu Tindak Lanjut',
    description: 'Kurir kami mengalami kendala dalam proses layanan. Tim bengkel akan membantu mengatur tindak lanjut.',
  },
};

const value = (variables: WhatsAppVariables, key: string) => String(variables[key] ?? '').trim();

function requiredValue(variables: WhatsAppVariables, key: string, label: string) {
  const item = value(variables, key);
  if (!item) throw new Error(`${label} wajib tersedia untuk notifikasi WhatsApp.`);
  return item;
}

function requiredTrackingCode(variables: WhatsAppVariables) {
  const trackingCode = requiredValue(variables, 'trackingCode', 'tracking_code');
  if (/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(trackingCode) || /^[0-9a-f]{32}$/i.test(trackingCode)) {
    throw new Error('tracking_code tidak valid: Nomor Resi tidak boleh berupa UUID.');
  }
  return trackingCode;
}

function formatDate(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  const dateParts = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value ?? '';
  const dateLabel = `${part('day')} ${part('month')} ${part('year')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return dateLabel;
  const timeParts = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Jakarta',
  }).formatToParts(date);
  const time = `${timeParts.find((item) => item.type === 'hour')?.value ?? ''}.${timeParts.find((item) => item.type === 'minute')?.value ?? ''}`;
  return `${dateLabel}, ${time} WIB`;
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(amount)) {
    throw new Error('Nominal pembayaran/estimasi tidak tersedia untuk notifikasi WhatsApp.');
  }
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`;
}

function bullet(label: string, text: string) {
  return `• *${label}:* ${text}`;
}

function formatQuotationItems(rawItems: unknown) {
  let items = rawItems;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { throw new Error('Rincian quotation tidak valid untuk notifikasi WhatsApp.'); }
  }
  if (!Array.isArray(items) || items.length === 0) throw new Error('Rincian quotation tidak tersedia untuk notifikasi WhatsApp.');

  return items.map((item: any, index) => {
    const partName = String(item.part_name ?? item.part_name_snapshot ?? item.description ?? '').trim();
    const description = String(item.damage_description ?? '').trim();
    const quantity = Number(item.qty);
    const isPart = item.item_type === 'part' || item.part_name || item.part_name_snapshot;
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || (isPart && !partName)) {
      throw new Error('Item quotation tidak lengkap untuk notifikasi WhatsApp.');
    }
    const part = isPart ? `${partName}${item.part_specification_snapshot ? ` (${item.part_specification_snapshot})` : ''} × ${quantity}` : 'Jasa';
    const partCost = item.part_cost ?? item.part_unit_price_snapshot ?? item.unit_price;
    const laborCost = item.labor_cost;
    const subtotal = item.subtotal;
    const cost = isPart
      ? `Part ${formatCurrency(partCost)} + jasa ${formatCurrency(laborCost)} = ${formatCurrency(subtotal)}`
      : `Jasa ${formatCurrency(laborCost || subtotal)}`;
    const availability = String(item.availability_status ?? '');
    const availableQty = Number(item.available_qty_snapshot);
    const stock = availability === 'TERSEDIA' || availability === 'Tersedia'
      ? 'Tersedia'
      : availability
        ? `Perlu dipesan${item.estimated_part_arrival_days ? ` (estimasi ${Number(item.estimated_part_arrival_days)} hari)` : ''}`
        : '';
    return `${index + 1}. ${description ? `${description}: ` : ''}${part}\n   ${cost}${stock ? `\n   Stok: ${stock}${availability === 'TERSEDIA_SEBAGIAN' && availableQty > 0 ? ` (${availableQty} tersedia)` : ''}` : ''}`;
  }).join('\n');
}

export function buildBookingNotification(variables: WhatsAppVariables) {
  const date = formatDate(variables.bookingDate);
  return [
    '*Booking Servis Berhasil* ✅',
    '',
    'Permintaan servis Anda telah kami terima.',
    '',
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    ...(value(variables, 'queueNumber') ? [bullet('Nomor Antrean', value(variables, 'queueNumber'))] : []),
    ...(date ? [bullet('Jadwal Booking', date)] : []),
  ].join('\n');
}

export function buildPickupNotification(variables: WhatsAppVariables) {
  const status = value(variables, 'status').toUpperCase();
  const failureReason = value(variables, 'failureReason').toUpperCase();
  const genericFailureStatus = status === 'PICKUP_FAILED' || status === 'DELIVERY_FAILED';
  const failure = genericFailureStatus
    ? COURIER_FAILURES[failureReason] ?? COURIER_FAILURES[status]
    : COURIER_FAILURES[status] ?? COURIER_FAILURES[failureReason];
  const detail = failure
    ? { title: failure.title, emoji: '⚠️', status: failure.status, description: failure.description }
    : PICKUP_STATUSES[status];
  if (!detail) throw new Error(`Status penjemputan tidak dikenali: ${status || '(kosong)'}`);
  return [
    `*${detail.title}* ${detail.emoji}`,
    '',
    detail.description,
    '',
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    bullet('Status', detail.status),
  ].join('\n');
}

export function buildCheckInNotification(variables: WhatsAppVariables) {
  return [
    '*Check-In Servis Berhasil* ✅',
    '',
    'Perangkat Anda telah resmi terdaftar di sistem servis kami.',
    '',
    bullet('Kode Tiket', requiredValue(variables, 'ticketCode', 'ticket_code')),
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    '',
    'Gunakan *Nomor Resi* di atas untuk memantau progres servis Anda melalui halaman Live Tracking.',
  ].join('\n');
}

export function buildServiceStatusNotification(variables: WhatsAppVariables) {
  const status = value(variables, 'status').toLowerCase();
  const label = SERVICE_STATUS_LABELS[status];
  if (!label) throw new Error(`Status servis tidak dikenali untuk notifikasi WhatsApp: ${status || '(kosong)'}`);
  const details = value(variables, 'details');
  return [
    '*Pembaruan Status Servis* 🔧',
    '',
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    bullet('Status Saat Ini', label),
    ...(details ? [bullet('Keterangan', details)] : []),
    ...(value(variables, 'trackingUrl') ? [bullet('Live Tracking', value(variables, 'trackingUrl'))] : []),
  ].join('\n');
}

export function buildQuotationNotification(variables: WhatsAppVariables, reminder = false) {
  const expiry = formatDate(variables.expiresAt);
  return [
    reminder ? '*Pengingat Quotation Servis* 📋' : '*Quotation Servis Tersedia* 📋',
    '',
    reminder
      ? 'Quotation servis Anda masih menunggu persetujuan. Berikut ringkasannya:'
      : 'Hasil pemeriksaan perangkat Anda telah selesai. Berikut rincian estimasi perbaikannya:',
    '',
    bullet('Kode Tiket', requiredValue(variables, 'ticketCode', 'ticket_code')),
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    bullet('Nomor Quotation', requiredValue(variables, 'quotationNumber', 'nomor quotation')),
    ...(!reminder ? ['', '*Keluhan Awal:*', value(variables, 'complaint') || 'Tidak ada catatan keluhan.', '', '*Hasil Pemeriksaan Teknisi:*', value(variables, 'diagnosis') || 'Tidak ada catatan pemeriksaan.', '', '*Rincian Estimasi:*', formatQuotationItems(variables.items), ''] : ['']),
    `*Total Estimasi:* *${formatCurrency(variables.totalAmount)}*`,
    ...(expiry ? [`*Berlaku s/d:* ${expiry}`] : []),
    '',
    'Silakan tinjau dan berikan persetujuan melalui tautan berikut:',
    requiredValue(variables, 'approvalLink', 'tautan persetujuan'),
  ].filter((line) => line !== undefined).join('\n');
}

export function buildPaymentNotification(templateName: string, variables: WhatsAppVariables) {
  const base = [
    bullet('No. Invoice', requiredValue(variables, 'invoiceNumber', 'nomor invoice')),
    bullet('Nomor Resi', requiredTrackingCode(variables)),
  ];
  if (templateName === 'payment_received') {
    return [
      '*Pembayaran Berhasil Diterima* ✅',
      '',
      'Terima kasih! Pembayaran servis Anda telah kami konfirmasi.',
      '',
      ...base,
      bullet('Total Dibayar', `*${formatCurrency(variables.amount)}*`),
      bullet('Status', '*LUNAS*'),
    ].join('\n');
  }

  const deadline = formatDate(variables.deadline);
  const lines = [
    '*Tagihan Pembayaran Servis* 💳',
    '',
    ...base,
    bullet('Bengkel', requiredValue(variables, 'workshopName', 'nama bengkel')),
    bullet('Total Pelunasan', `*${formatCurrency(variables.totalAmount)}*`),
    ...(deadline ? [bullet('Batas Pembayaran', deadline)] : []),
  ];
  if (templateName === 'payment_link') {
    lines.push('', 'Silakan selesaikan pembayaran Anda melalui tautan berikut:', requiredValue(variables, 'paymentLink', 'tautan pembayaran'));
  } else {
    const bank = value(variables, 'bankName');
    const account = value(variables, 'bankAccountNumber');
    const qris = value(variables, 'qrisUrl');
    const ewallet = value(variables, 'ewalletAccount');
    lines.push('', '*Instruksi Pembayaran:*');
    if (account) {
      const accountName = value(variables, 'bankAccountName');
      lines.push(bullet('Transfer', `${bank || 'bank'}${accountName ? ` a.n. ${accountName}` : ''} — ${account}`));
    }
    if (qris) lines.push(bullet('QRIS', qris));
    if (ewallet) lines.push(bullet('E-Wallet', `${value(variables, 'ewalletProvider')} ${ewallet}`.trim()));
    if (!account && !qris && !ewallet) lines.push('Silakan hubungi bengkel untuk memperoleh instruksi pembayaran.');
    lines.push('', 'Pembayaran merupakan pelunasan penuh sesuai total invoice.');
  }
  return lines.join('\n');
}

export function buildDeliveryNotification(variables: WhatsAppVariables) {
  const status = value(variables, 'status').toUpperCase();
  const failureReason = value(variables, 'failureReason').toUpperCase();
  const genericFailureStatus = status === 'PICKUP_FAILED' || status === 'DELIVERY_FAILED';
  const failure = genericFailureStatus
    ? COURIER_FAILURES[failureReason] ?? COURIER_FAILURES[status]
    : COURIER_FAILURES[status] ?? COURIER_FAILURES[failureReason];
  const detail = failure
    ? { title: failure.title, emoji: '⚠️', status: failure.status, description: failure.description }
    : DELIVERY_STATUSES[status];
  if (!detail) throw new Error(`Status pengantaran tidak dikenali: ${status || '(kosong)'}`);
  return [
    `*${detail.title}* ${detail.emoji}`,
    '',
    detail.description,
    '',
    bullet('Nomor Resi', requiredTrackingCode(variables)),
    bullet('Status', detail.status),
  ].join('\n');
}

export function buildConnectionTestNotification(variables: WhatsAppVariables) {
  return [
    '*Tes Koneksi WhatsApp ServiTrack* ✅',
    '',
    'Pesan ini dikirim untuk memastikan koneksi WhatsApp bengkel berfungsi.',
    '',
    bullet('Bengkel', requiredValue(variables, 'workshopName', 'nama bengkel')),
  ].join('\n');
}

export function renderWhatsAppTemplate(templateName: string, variables: WhatsAppVariables) {
  switch (templateName) {
    case 'booking_dropoff_created': return buildBookingNotification(variables);
    case 'service_ticket_created': return buildCheckInNotification(variables);
    case 'ticket_status_changed':
    case 'ready_for_pickup': return buildServiceStatusNotification(variables);
    case 'quotation_created': return buildQuotationNotification(variables);
    case 'quotation_reminder': return buildQuotationNotification(variables, true);
    case 'payment_link':
    case 'payment_instruction':
    case 'payment_received': return buildPaymentNotification(templateName, variables);
    case 'courier_pickup': return buildPickupNotification(variables);
    case 'courier_delivery': return buildDeliveryNotification(variables);
    case 'connection_test': return buildConnectionTestNotification(variables);
    default: throw new Error(`Template WhatsApp tidak dikenal: ${templateName}`);
  }
}
