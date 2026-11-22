export interface QuotationLinePricingInput {
  qty: number;
  laborCost: number;
  partUnitPrice?: number | null;
  availableQty?: number | null;
  estimatedPartArrivalDays: number;
}

export function priceQuotationLine(input: QuotationLinePricingInput) {
  const hasPart = input.partUnitPrice !== null && input.partUnitPrice !== undefined;
  const partCost = hasPart ? Number(input.partUnitPrice) * input.qty : 0;
  const availableQty = hasPart ? Number(input.availableQty ?? 0) : null;
  const availabilityStatus = !hasPart
    ? null
    : availableQty === 0
      ? 'TIDAK_TERSEDIA'
      : availableQty! < input.qty
        ? 'TERSEDIA_SEBAGIAN'
        : 'TERSEDIA';
  return {
    partCost,
    subtotal: partCost + input.laborCost,
    availabilityStatus,
    availableQtySnapshot: availableQty,
    estimatedPartArrivalDays: hasPart && availabilityStatus !== 'TERSEDIA' ? input.estimatedPartArrivalDays : null,
  };
}
