import { useQuery } from '@tanstack/react-query';
import { trackTicket, type TrackResult } from '../lib/api';

export function useTicketTracking(code: string | null) {
  return useQuery<TrackResult, any>({
    queryKey: ['public-track', code],
    queryFn: () => trackTicket(code as string),
    enabled: Boolean(code),
    retry: 0,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
}
