type Variables = Record<string, string | number>;

const value = (variables: Variables, key: string) => String(variables[key] ?? '-');

export function renderWhatsAppTemplate(templateName: string, variables: Variables) {
  const templates: Record<string, string> = {
    booking_dropoff_created: [
      'Booking berhasil dibuat.',
      '',
      `Nomor Resi: ${value(variables, 'trackingCode')}`,
      `Nomor Antrian: ${value(variables, 'queueNumber')}`,
      `Tanggal Booking: ${value(variables, 'bookingDate')}`,
    ].join('\n'),
    service_ticket_created: [
      'Check-in servis berhasil.',
      '',
      `Kode Tiket: ${value(variables, 'ticketCode')}`,
      `Nomor Resi: ${value(variables, 'trackingCode')}`,
    ].join('\n'),
    ticket_status_changed: [
      'Status servis Anda berubah.',
      '',
      `Nomor Resi: ${value(variables, 'trackingCode')}`,
      `Status: ${value(variables, 'status')}`,
    ].join('\n'),
    quotation_created: [
      'Quotation servis baru tersedia.',
      '',
      `Nomor Quotation: ${value(variables, 'quotationNumber')}`,
      `Total Estimasi: ${value(variables, 'totalAmount')}`,
      `Link Approval: ${value(variables, 'approvalLink')}`,
    ].join('\n'),
    payment_received: [
      'Pembayaran servis diterima.',
      '',
      `Invoice: ${value(variables, 'invoiceNumber')}`,
      `Nominal: ${value(variables, 'amount')}`,
      `Status Pembayaran: ${value(variables, 'paymentStatus')}`,
    ].join('\n'),
    ready_for_pickup: [
      'Perangkat Anda siap diambil.',
      '',
      `Nomor Resi: ${value(variables, 'trackingCode')}`,
      'Silakan datang ke cabang ServiTrack untuk pengambilan perangkat.',
    ].join('\n'),
  };

  return templates[templateName] ?? Object.entries(variables).map(([key, item]) => `${key}: ${item}`).join('\n');
}
