import { useMutation } from '@tanstack/react-query';
import { createPublicBooking, type PublicBookingInput, type PublicBookingResult } from '../lib/api';

export function usePublicBooking() {
  return useMutation<PublicBookingResult, any, PublicBookingInput>({
    mutationFn: (input) => createPublicBooking(input),
  });
}
