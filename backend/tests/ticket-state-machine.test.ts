import { describe, expect, it } from 'vitest';
import { allowedTicketTransitions, canTransitionTicket } from '../../common/utils/TicketStatuses';

describe('ticket status machine', () => {
  it('allows the required workflow paths and recovery transitions', () => {
    expect(canTransitionTicket('pengecekan', 'pengerjaan')).toBe(true);
    expect(canTransitionTicket('pengecekan', 'menunggu_part')).toBe(true);
    expect(canTransitionTicket('pengecekan', 'menunggu_persetujuan')).toBe(true);
    expect(canTransitionTicket('menunggu_persetujuan', 'pengerjaan')).toBe(true);
    expect(canTransitionTicket('menunggu_persetujuan', 'menunggu_part')).toBe(true);
    expect(canTransitionTicket('menunggu_persetujuan', 'siap_diambil')).toBe(true);
    expect(canTransitionTicket('pengerjaan', 'menunggu_part')).toBe(true);
    expect(canTransitionTicket('quality_check', 'pengerjaan')).toBe(true);
  });

  it('rejects illegal moves and exposes the same allowed targets to UI callers', () => {
    expect(canTransitionTicket('antrian', 'quality_check')).toBe(false);
    expect(canTransitionTicket('menunggu_part', 'quality_check')).toBe(false);
    expect(allowedTicketTransitions('antrian')).toEqual(['pengecekan', 'batal']);
  });
});
