import { create } from 'zustand';

export interface BookingDate {
  iso: string;
  slots: number;
}

interface BookingState {
  selectedDate: BookingDate | null;
  preserveOnExit: boolean;
  setSelectedDate: (date: BookingDate | null) => void;
  setPreserveOnExit: (preserve: boolean) => void;
}

export const useBookingStore = create<BookingState>()((set) => ({
  selectedDate: null,
  preserveOnExit: false,
  setSelectedDate: (date) => set({ selectedDate: date }),
  setPreserveOnExit: (preserve) => set({ preserveOnExit: preserve }),
}));