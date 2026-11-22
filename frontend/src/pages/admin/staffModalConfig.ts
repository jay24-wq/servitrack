export const staffModalInputClass =
  'w-full rounded-lg bg-stone-100 px-3 py-1.5 text-xs leading-4 text-zinc-900 outline outline-1 -outline-offset-1 outline-black/10 placeholder:text-neutral-400 focus:bg-white focus:outline-2 focus:outline-sky-600';

export const STAFF_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'frontdesk', label: 'Frontdesk' },
  { value: 'teknisi', label: 'Teknisi' },
  { value: 'kurir', label: 'Kurir' },
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number]['value'];
