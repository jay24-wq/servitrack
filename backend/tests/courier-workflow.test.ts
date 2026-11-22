import { describe, expect, it } from 'vitest';
import {
  COURIER_ALLOWED_TRANSITIONS,
  isValidCourierFailure,
  COURIER_TERMINAL_STATUSES,
  isCourierAssignmentComplete,
} from '../src/services/courierWorkflow';
import { ticketCustomerSnapshot } from '../src/services/ticketCustomerSnapshot';
import { canCheckInBooking, mapBookingRow, mapServiceTicketToQueueTicket } from '../../frontend/src/lib/mappers';
import { courierFailureFormReady, googleMapsDirectionsUrl, localPhoneNumber, resolveCourierDestination } from '../../frontend/src/lib/courier-task';

describe('pickup courier workflow', () => {
  it('takes the device from pickup to the workshop without a check-in status', () => {
    expect(COURIER_ALLOWED_TRANSITIONS.PERANGKAT_DIJEMPUT).toContain('MENUJU_TOKO');
    expect(COURIER_ALLOWED_TRANSITIONS.PERANGKAT_DIJEMPUT).not.toContain('MENUNGGU_CHECK_IN');
    expect(COURIER_ALLOWED_TRANSITIONS.MENUJU_TOKO).toContain('PERANGKAT_TIBA_DI_WORKSHOP');
  });

  it('completes pickup at workshop arrival, not before', () => {
    expect(isCourierAssignmentComplete('pickup', 'MENUJU_TOKO')).toBe(false);
    expect(isCourierAssignmentComplete('pickup', 'PERANGKAT_TIBA_DI_WORKSHOP')).toBe(true);
    expect(COURIER_TERMINAL_STATUSES).toContain('PERANGKAT_TIBA_DI_WORKSHOP');
    expect(isCourierAssignmentComplete('delivery', 'PERANGKAT_TIBA_DI_WORKSHOP')).toBe(false);
  });

  it('keeps pickup check-in unavailable until the courier confirms workshop arrival', () => {
    expect(canCheckInBooking({ status: 'MENUNGGU_CHECKIN', method: 'terjadwal', courierPickupStatus: 'MENUJU_TOKO' })).toBe(false);
    expect(canCheckInBooking({ status: 'MENUNGGU_CHECKIN', method: 'antar_jemput', courierPickupStatus: 'PERANGKAT_TIBA_DI_WORKSHOP' })).toBe(true);
    expect(canCheckInBooking({ status: 'MENUNGGU_CHECKIN', method: 'mandiri', courierPickupStatus: null })).toBe(true);
  });

  it('maps stored booking PIN and refusal choice for the check-in form', () => {
    const withPin = mapBookingRow({ id: 'booking-1', service_method: 'pickup_only', device_pin: '1234', device_pin_refused: false });
    const refused = mapBookingRow({ id: 'booking-2', service_method: 'pickup_delivery', device_pin: null, device_pin_refused: true });

    expect(withPin.devicePin).toBe('1234');
    expect(withPin.pinRefused).toBe(false);
    expect(refused.devicePin).toBeNull();
    expect(refused.pinRefused).toBe(true);
  });

  it('maps the ticket PIN into the technician Kanban detail model', () => {
    const kanbanTicket = mapServiceTicketToQueueTicket({
      ticket_code: 'SRV0562313398',
      current_status: 'antrian',
      complaint: 'Layar tidak menyala',
      service_method: 'pickup_only',
      created_at: new Date().toISOString(),
      device_pin: '1029',
      device_pin_refused: false,
    });

    expect(kanbanTicket.devicePin).toBe('1029');
    expect(kanbanTicket.pinRefused).toBe(false);
    const refused = mapServiceTicketToQueueTicket({
      ticket_code: 'SRV0562313399',
      current_status: 'antrian',
      complaint: 'Tidak mau membuka perangkat',
      service_method: 'pickup_only',
      created_at: new Date().toISOString(),
      device_pin: null,
      device_pin_refused: true,
    });
    expect(refused.devicePin).toBeNull();
    expect(refused.pinRefused).toBe(true);
  });

  it('copies booking contact and pickup coordinates into a ticket snapshot without changing the customer', () => {
    expect(ticketCustomerSnapshot({
      customer_phone: '08347273648',
      pickup_address: 'Jl. Melati 8, Denpasar',
      pickup_latitude: -8.65,
      pickup_longitude: 115.21,
    }, { phone_wa: '08999999999', address: 'Alamat profil' })).toEqual({
      customer_phone_snapshot: '08347273648',
      customer_address_snapshot: 'Jl. Melati 8, Denpasar',
      customer_latitude: -8.65,
      customer_longitude: 115.21,
    });
    expect(ticketCustomerSnapshot(null, { phone_wa: '08347273648', address: 'Alamat profil' })).toEqual({
      customer_phone_snapshot: '08347273648',
      customer_address_snapshot: 'Alamat profil',
      customer_latitude: null,
      customer_longitude: null,
    });
  });

  it('requires a note only for the Lainnya failure reason', () => {
    expect(isValidCourierFailure('CUSTOMER_NOT_HOME', '')).toBe(true);
    expect(isValidCourierFailure('OTHER', '  ')).toBe(false);
    expect(isValidCourierFailure('OTHER', 'Keterangan tambahan')).toBe(true);
    expect(isValidCourierFailure('INVALID', 'Catatan')).toBe(false);
    expect(courierFailureFormReady('', '')).toBe(false);
    expect(courierFailureFormReady('OTHER', '  ')).toBe(false);
    expect(courierFailureFormReady('CUSTOMER_NOT_HOME', '')).toBe(true);
    expect(courierFailureFormReady('CUSTOMER_NOT_HOME', '', true)).toBe(false);
  });

  it('routes pickup to the customer before collection and to its ticket branch afterward', () => {
    const customer = { customer_name: 'Dewi', customer_address: 'Alamat rumah', customer_latitude: '-8.6', customer_longitude: '115.2' };
    const store = { branch_name: 'ServiTrack Renon', branch_address: 'Alamat toko', store_latitude: '-8.7', store_longitude: '115.1' };
    expect(resolveCourierDestination({ ...customer, ...store, assignment_type: 'pickup', status: 'MENUJU_LOKASI' }).label).toBe('Alamat pelanggan');
    expect(resolveCourierDestination({ ...customer, ...store, assignment_type: 'pickup', status: 'PERANGKAT_DIJEMPUT' })).toMatchObject({
      label: 'Alamat toko', name: 'ServiTrack Renon', latitude: -8.7, longitude: 115.1,
    });
  });

  it('routes delivery to the customer and tolerates missing location fields', () => {
    expect(resolveCourierDestination({
      assignment_type: 'delivery', status: 'SIAP_DIANTAR', customer_name: 'Dewi', customer_address: 'Alamat rumah', customer_latitude: '-8.6', customer_longitude: '115.2',
    })).toMatchObject({ label: 'Alamat pelanggan', name: 'Dewi', latitude: -8.6, longitude: 115.2 });
    expect(resolveCourierDestination({ assignment_type: 'delivery', status: 'SIAP_DIANTAR' })).toMatchObject({
      label: 'Alamat pelanggan', address: null, latitude: null, longitude: null,
    });
  });

  it('uses coordinates before address for navigation and formats Indonesian phone numbers locally', () => {
    expect(googleMapsDirectionsUrl({ name: null, address: 'Jalan Melati 8', latitude: -8.6, longitude: 115.2, label: 'Alamat pelanggan' }))
      .toContain('destination=-8.6%2C115.2');
    expect(googleMapsDirectionsUrl({ name: null, address: 'Jalan Melati 8', latitude: null, longitude: null, label: 'Alamat pelanggan' }))
      .toContain(encodeURIComponent('Jalan Melati 8'));
    expect(googleMapsDirectionsUrl({ name: null, address: null, latitude: null, longitude: null, label: 'Alamat pelanggan' })).toBeNull();
    expect(localPhoneNumber('+62 834-7273-648')).toBe('08347273648');
    expect(localPhoneNumber('8347273648')).toBe('08347273648');
    expect(localPhoneNumber(null)).toBeNull();
  });
});
