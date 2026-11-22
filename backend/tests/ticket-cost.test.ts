import { describe, expect, it } from 'vitest';
import { calculateTicketCost } from '../src/services/ticketCost';

describe('ticket cost policy', () => {
  const fees = { serviceFee: 50_000, diagnosticFee: 20_000, partsCost: 30_000, deliveryFee: 10_000 };

  it('charges labor but not diagnostic fee during normal work, including continue-original', () => {
    expect(calculateTicketCost({ currentStatus: 'pengerjaan', workflowResolution: null, ...fees })).toEqual({
      serviceFee: 50_000, diagnosticFee: 0, partsCost: 30_000, deliveryFee: 10_000, finalCost: 90_000,
    });
    expect(calculateTicketCost({ currentStatus: 'pengerjaan', workflowResolution: 'continue_original', ...fees }).finalCost).toBe(90_000);
  });

  it('charges diagnostics and no labor for cancelled service, including returned rejected tickets', () => {
    expect(calculateTicketCost({ currentStatus: 'batal', ...fees })).toEqual({
      serviceFee: 0, diagnosticFee: 20_000, partsCost: 30_000, deliveryFee: 10_000, finalCost: 60_000,
    });
    expect(calculateTicketCost({ currentStatus: 'siap_diambil', workflowResolution: 'cancel_and_return', ...fees }).finalCost).toBe(60_000);
  });

  it('does not charge a saved diagnostic fee on an ordinary ready-for-pickup ticket', () => {
    expect(calculateTicketCost({ currentStatus: 'siap_diambil', ...fees }).finalCost).toBe(90_000);
  });

  it('keeps the completed-ticket invoice total equal to service, used parts, and delivery', () => {
    expect(calculateTicketCost({
      currentStatus: 'selesai',
      serviceFee: 150_000,
      diagnosticFee: 20_000,
      partsCost: 190_000,
      deliveryFee: 14_000,
    })).toEqual({ serviceFee: 150_000, diagnosticFee: 0, partsCost: 190_000, deliveryFee: 14_000, finalCost: 354_000 });
  });
});
