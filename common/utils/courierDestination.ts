export type CourierPlace = {
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  label: 'Alamat pelanggan' | 'Alamat toko';
};

type CourierDestinationTask = Partial<{
  assignment_type: 'pickup' | 'delivery';
  status: string;
  device_picked_up: boolean;
  branch_name: string | null;
  tenant_name: string | null;
  branch_address: string | null;
  tenant_address: string | null;
  store_latitude: number | string | null;
  store_longitude: number | string | null;
  customer_name: string | null;
  customer_address: string | null;
  pickup_address: string | null;
  customer_latitude: number | string | null;
  customer_longitude: number | string | null;
  pickup_latitude: number | string | null;
  pickup_longitude: number | string | null;
}>;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function coordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function wasPickedUp(task: CourierDestinationTask) {
  return task.device_picked_up === true || [
    'PERANGKAT_DIJEMPUT', 'MENUJU_TOKO', 'PERANGKAT_TIBA_DI_WORKSHOP', 'SELESAI',
  ].includes(task.status || '');
}

export function resolveCourierDestination(task: CourierDestinationTask): CourierPlace {
  const pickupReturnsToStore = task.assignment_type === 'pickup' && wasPickedUp(task);
  if (pickupReturnsToStore) {
    return {
      name: text(task.branch_name) ?? text(task.tenant_name),
      address: text(task.branch_address) ?? text(task.tenant_address),
      latitude: coordinate(task.store_latitude, -90, 90),
      longitude: coordinate(task.store_longitude, -180, 180),
      label: 'Alamat toko',
    };
  }

  return {
    name: text(task.customer_name),
    address: text(task.customer_address) ?? text(task.pickup_address),
    latitude: coordinate(task.customer_latitude ?? task.pickup_latitude, -90, 90),
    longitude: coordinate(task.customer_longitude ?? task.pickup_longitude, -180, 180),
    label: 'Alamat pelanggan',
  };
}
