type BookingCustomerLocation = {
  customer_name?: string | null;
  customer_phone?: string | null;
  pickup_address?: string | null;
  pickup_latitude?: number | string | null;
  pickup_longitude?: number | string | null;
} | null;

type CustomerContact = {
  name?: string | null;
  phone_wa?: string | null;
  address?: string | null;
} | null;

const present = (value?: string | null) => value?.trim() || null;

export function ticketCustomerSnapshot(booking: BookingCustomerLocation, customer: CustomerContact, customerName?: string | null) {
  return {
    customer_name: present(booking?.customer_name) ?? present(customerName) ?? present(customer?.name),
    customer_phone_snapshot: present(booking?.customer_phone) ?? present(customer?.phone_wa),
    customer_address_snapshot: present(booking?.pickup_address) ?? present(customer?.address),
    customer_latitude: booking?.pickup_latitude ?? null,
    customer_longitude: booking?.pickup_longitude ?? null,
  };
}
