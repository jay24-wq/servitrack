import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowSquareOut,
  ArrowUUpLeft,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  EyeSlash,
  NotePencil,
  Package,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  Trash,
  Wrench,
  XCircle,
} from '@phosphor-icons/react';

import { Button } from '../../components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Separator } from '../../components/ui/separator';
import { cn } from '../../lib/utils';
import { useAuthStore, useTicketStore, type PartUsage, type QueueStatus, type QueueTicket } from '../../store';
import { useInventoryParts } from '../../hooks/useInventoryParts';
import { formatInventoryNumber as angka, inventoryStockStatus, mapInventoryPart, parseInventoryNumber } from '../../lib/inventory-parts';
import { DB_STATUS_MAP, STATUS_TO_DB } from '../../lib/mappers';
import { canTransitionTicket } from '../../../../common/utils/TicketStatuses';
import {
  createTicketQuotation,
  getTicket,
  getTicketPartUsages,
  recordTicketPartUsage,
  resolveRejectedQuotation,
  saveTicketAssessment,
  saveTicketServiceFee,
  saveTicketDiagnosticFee,
  saveTicketWorkNote,
  retryTicketQuotation,
  decideTicketQuotationManually,
  type TicketAssessmentInput,
  type TicketQuotationInput,
} from '../../lib/api';

interface TicketDetailSheetProps {
  ticketId: string | null;
  open: boolean;
  onStatusChange: (id: string, status: QueueStatus, patch: Partial<QueueTicket>) => Promise<void>;
  statusSaving: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNLISTED_PART = '__unlisted_part__';
type QuotationLineState = {
  damage_description: string;
  part_id: string;
  is_unregistered_part: boolean;
  requested_name: string;
  specification: string;
  qty: number;
  estimated_price: string;
  estimated_part_arrival_days: string;
  labor_cost: string;
};

const STATUS_TONE: Record<QueueStatus, string> = {
  Antrian: 'bg-amber-50 text-amber-700 outline-amber-200',
  Pengecekan: 'bg-blue-50 text-sky-700 outline-blue-200',
  'Menunggu Part': 'bg-rose-50 text-rose-700 outline-rose-200',
  'Menunggu Persetujuan': 'bg-amber-50 text-amber-800 outline-amber-200',
  Pengerjaan: 'bg-sky-50 text-sky-700 outline-sky-200',
  'Quality Control': 'bg-indigo-50 text-indigo-700 outline-indigo-200',
  Selesai: 'bg-emerald-50 text-emerald-700 outline-emerald-200',
  'Siap Diambil': 'bg-violet-50 text-violet-700 outline-violet-200',
  Dibatalkan: 'bg-stone-100 text-stone-600 outline-stone-300',
};

export default function TicketDetailSheet({ ticketId, open, onStatusChange, statusSaving, onOpenChange }: TicketDetailSheetProps) {
  const ticket = useTicketStore((s) => s.tickets.find((t) => t.id === ticketId) ?? null);
  const updateTicket = useTicketStore((s) => s.updateTicket);
  const technician = useAuthStore((s) => s.user?.name) ?? '—';
  const currentRole = (useAuthStore((s) => s.user?.role) ?? '').toLowerCase();
  const tenantId = useAuthStore((s) => s.user?.tenant_id ?? null);
  const queryClient = useQueryClient();

  const [showPin, setShowPin] = useState(false);
  const [workType, setWorkType] = useState<'' | 'without_parts' | 'with_parts'>('');
  const [diagnosisStatus, setDiagnosisStatus] = useState<'' | 'matches_complaint' | 'additional_damage'>('');
  const [technicianDiagnosis, setTechnicianDiagnosis] = useState('');
  const [extraQuotationLines, setExtraQuotationLines] = useState<QuotationLineState[]>([]);
  const [unlistedPartName, setUnlistedPartName] = useState('');
  const [unlistedPartSpecification, setUnlistedPartSpecification] = useState('');
  const [unlistedPartPrice, setUnlistedPartPrice] = useState('');
  const [unlistedPartArrivalDays, setUnlistedPartArrivalDays] = useState('');
  const [laborEstimate, setLaborEstimate] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [diagnosticFee, setDiagnosticFee] = useState('0');
  const [diagnosticFeeError, setDiagnosticFeeError] = useState('');
  const [partId, setPartId] = useState('');
  const [qty, setQty] = useState(1);
  const [workNote, setWorkNote] = useState('');
  const [workPartId, setWorkPartId] = useState('');
  const [workPartQty, setWorkPartQty] = useState(1);
  const [statusError, setStatusError] = useState('');
  const [assessmentError, setAssessmentError] = useState('');
  const [usageError, setUsageError] = useState('');
  const [serviceFeeError, setServiceFeeError] = useState('');
  const [workNoteError, setWorkNoteError] = useState('');
  const [manualApprovalNote, setManualApprovalNote] = useState('');
  const [manualApprovalError, setManualApprovalError] = useState('');
  const hydratedTicketId = useRef<string | null>(null);
  const { data: inventoryRows = [], isLoading: inventoryLoading, isError: inventoryError, refetch: refetchInventory } = useInventoryParts('active', open);
  const parts = useMemo(() => inventoryRows.map(mapInventoryPart), [inventoryRows]);
  const ticketDetailQuery = useQuery({
    queryKey: ['ticket-inspection', tenantId, ticket?.recordId],
    queryFn: () => getTicket(ticket!.recordId!),
    enabled: open && Boolean(ticket?.recordId),
    staleTime: 0,
    refetchInterval: (query) => query.state.data?.quotation?.notification?.status === 'queued'
      ? 1000
      : ticket?.status === 'Menunggu Persetujuan' || ticket?.status === 'Menunggu Part' ? 15_000 : false,
  });
  const workflowTicket = ticketDetailQuery.data ?? ticket;
  const quotation = workflowTicket?.quotation ?? null;
  const quotedPartIds = new Set<string>(
    quotation?.status === 'approved'
      ? quotation.items.filter((item: any) => item.item_type === 'part' && item.part_id).map((item: any) => item.part_id)
      : []
  );
  const quoteRequiresApprovedParts = workflowTicket?.diagnosis_status === 'additional_damage' && workflowTicket?.workflow_resolution !== 'continue_original';
  const workParts = quoteRequiresApprovedParts ? parts.filter((part) => quotedPartIds.has(part.id)) : parts;
  const currentWorkType = workflowTicket?.work_type ?? workflowTicket?.workType ?? null;
  const inspectionMutation = useMutation({
    mutationFn: (input: { ticketId: string; body: TicketAssessmentInput | TicketQuotationInput }) =>
      'ticket_id' in input.body
        ? createTicketQuotation(input.body as TicketQuotationInput)
        : saveTicketAssessment(input.ticketId, input.body),
    onSuccess: async (_, input) => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, input.ticketId] }),
    ]),
    retry: false,
  });
  const rejectionResolutionMutation = useMutation({
    mutationFn: (action: 'continue_original' | 'cancel_and_return') => {
      if (!ticket?.recordId || !quotation?.id) throw new Error('Quotation tidak tersedia');
      return resolveRejectedQuotation(ticket.recordId, quotation.id, action);
    },
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, ticket?.recordId] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket?.recordId] }),
    ]),
    retry: false,
  });
  const ticketPartUsagesQuery = useQuery({
    queryKey: ['ticket-part-usages', tenantId, ticket?.recordId],
    queryFn: () => getTicketPartUsages(ticket!.recordId!),
    enabled: open && Boolean(ticket?.recordId),
    staleTime: 0,
  });
  const usageMutation = useMutation({
    mutationFn: recordTicketPartUsage,
    onSuccess: async (_, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ticket-part-usages', tenantId, input.ticket_id] }),
        queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, input.ticket_id] }),
        queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['ticket', input.ticket_id] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-parts'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
      ]);
    },
    retry: false,
  });
  const serviceFeeMutation = useMutation({
    mutationFn: (fee: number) => saveTicketServiceFee(ticket!.recordId!, fee),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, ticket?.recordId] }),
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket?.recordId] }),
    ]),
    retry: false,
  });
  const diagnosticFeeMutation = useMutation({
    mutationFn: (fee: number) => saveTicketDiagnosticFee(ticket!.recordId!, fee),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, ticket?.recordId] }),
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['tickets'] }),
      queryClient.invalidateQueries({ queryKey: ['ticket', ticket?.recordId] }),
    ]),
    retry: false,
  });
  const workNoteMutation = useMutation({
    mutationFn: (content: string) => saveTicketWorkNote(ticket!.recordId!, content),
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, ticket?.recordId] }),
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
    ]),
    retry: false,
  });
  const retryQuotationMutation = useMutation({
    mutationFn: retryTicketQuotation,
    onSuccess: async () => {
      queryClient.setQueryData(['ticket-inspection', tenantId, ticket?.recordId], (current: any) => current ? {
        ...current,
        quotation: { ...current.quotation, status: 'draft', notification: { status: 'queued', attempt_count: 0 } },
      } : current);
      await queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] });
    },
    retry: false,
  });
  const manualDecisionMutation = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') => {
      if (!quotation?.id) throw new Error('Quotation tidak tersedia');
      return decideTicketQuotationManually(quotation.id, decision, manualApprovalNote.trim());
    },
    onSuccess: async () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['ticket-inspection', tenantId, ticket?.recordId] }),
      queryClient.invalidateQueries({ queryKey: ['technician-dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['part-requests'] }),
    ]),
    retry: false,
  });
  const partsUsed = useMemo<PartUsage[]>(
    () => (ticketPartUsagesQuery.data ?? []).filter((usage) => Number(usage.net_qty ?? usage.qty) > 0).map((usage) => ({
      id: usage.part_id,
      name: usage.part_name,
      sku: usage.part_sku,
      unit: usage.unit,
      qty: Number(usage.net_qty ?? usage.qty),
      price: Number(usage.unit_price),
      usedAt: usage.used_at,
      usedBy: usage.technician_name ?? undefined,
    })),
    [ticketPartUsagesQuery.data]
  );
  useEffect(() => {
    if (!ticket || !open || hydratedTicketId.current === ticket.id) return;
    if (ticket.recordId && !ticketDetailQuery.data) return;
    const current = ticketDetailQuery.data ?? ticket;
    setWorkType(current.work_type ?? current.workType ?? '');
    setDiagnosisStatus(current.diagnosis_status ?? current.diagnosisStatus ?? '');
    setTechnicianDiagnosis(current.technician_diagnosis ?? current.technicianDiagnosis ?? '');
    setExtraQuotationLines([]);
    setUnlistedPartName('');
    setUnlistedPartSpecification('');
    setUnlistedPartPrice('');
    setUnlistedPartArrivalDays('');
    setManualApprovalNote('');
    setServiceFee(current.service_fee == null ? '' : angka(Number(current.service_fee)));
    setDiagnosticFee(String(current.diagnostic_fee ?? 0));
    setPartId(current.requested_part_id ?? current.requestedPartId ?? '');
    setQty(Number(current.requested_part_qty ?? current.requestedPartQty ?? 1));
    hydratedTicketId.current = ticket.id;
    setWorkNote('');
    setWorkPartId('');
    setWorkPartQty(1);
    setManualApprovalError('');
    setDiagnosticFeeError('');
  }, [open, ticket, ticketDetailQuery.data]);

  useEffect(() => {
    const detail = ticketDetailQuery.data;
    if (!ticket || !detail) return;
    const status = DB_STATUS_MAP[detail.current_status] ?? ticket.status;
    updateTicket(ticket.id, {
      status,
      workType: detail.work_type ?? null,
      diagnosisStatus: detail.diagnosis_status ?? null,
      technicianDiagnosis: detail.technician_diagnosis ?? null,
      additionalDamage: detail.additional_damage ?? null,
      requestedPartId: detail.requested_part_id ?? null,
      requestedPartQty: detail.requested_part_qty === null || detail.requested_part_qty === undefined ? null : Number(detail.requested_part_qty),
    });
  }, [ticket?.id, ticket?.status, ticketDetailQuery.data, updateTicket]);

  useEffect(() => setShowPin(false), [ticketId, open]);

  const initials = useMemo(
    () =>
      technician
        .split(' ')
        .slice(0, 2)
        .map((p) => p.charAt(0))
        .join('')
        .toUpperCase(),
    [technician]
  );

  const selectedPart = parts.find((p) => p.id === partId) ?? null;
  const selectedWorkPart = workParts.find((p) => p.id === workPartId) ?? null;
  const primaryUnlistedPart = partId === UNLISTED_PART;
  const primaryUnlistedValid = Boolean(
    unlistedPartName.trim() && unlistedPartPrice.trim() && Number.isFinite(Number(unlistedPartPrice)) && Number(unlistedPartPrice) > 0 &&
    Number.isSafeInteger(Number(unlistedPartArrivalDays)) && Number(unlistedPartArrivalDays) > 0
  );
  const extraUnlistedInvalid = extraQuotationLines.some((line) => line.is_unregistered_part && (
    !line.requested_name.trim() || !line.estimated_price.trim() || !Number.isFinite(Number(line.estimated_price)) || Number(line.estimated_price) <= 0 ||
    !Number.isSafeInteger(Number(line.estimated_part_arrival_days)) || Number(line.estimated_part_arrival_days) <= 0
  ));
  const primaryPartValid = workType !== 'with_parts' || (primaryUnlistedPart ? primaryUnlistedValid : Boolean(selectedPart));
  const extraLinesValid = extraQuotationLines.every((line) => line.is_unregistered_part
    ? Boolean(line.requested_name.trim() && line.estimated_price.trim() && Number.isFinite(Number(line.estimated_price)) && Number(line.estimated_price) > 0 && Number.isSafeInteger(Number(line.estimated_part_arrival_days)) && Number(line.estimated_part_arrival_days) > 0 && Number.isSafeInteger(line.qty) && line.qty > 0)
    : Boolean((line.part_id && Number.isSafeInteger(line.qty) && line.qty > 0) || (diagnosisStatus === 'additional_damage' && Number(line.labor_cost) > 0)));
  const hasQuotedPart = workType === 'with_parts' && (Boolean(selectedPart) || primaryUnlistedPart || extraQuotationLines.some((line) => Boolean(line.part_id)));
  const needsInventoryData = workType === 'with_parts' && (!primaryUnlistedPart || extraQuotationLines.some((line) => line.part_id && !line.is_unregistered_part));
  const hasUnlistedPart = primaryUnlistedPart || extraQuotationLines.some((line) => line.is_unregistered_part);
  const needsInspectionQuotation = diagnosisStatus === 'additional_damage' || hasUnlistedPart || extraQuotationLines.length > 0;

  if (!ticket) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl" />
      </Sheet>
    );
  }

  const techPatch: Partial<QueueTicket> = ticket.technician
    ? {}
    : { technician: technician, technicianInitials: initials };

  const moveTo = async (status: QueueStatus, patch: Partial<QueueTicket> = {}) => {
    setStatusError('');
    if (!canTransitionTicket(STATUS_TO_DB[ticket.status], STATUS_TO_DB[status])) {
      setStatusError(`Transisi ${ticket.status} → ${status} tidak diizinkan.`);
      return;
    }
    try {
      await onStatusChange(ticket.id, status, { ...techPatch, ...patch });
    } catch {
      setStatusError('Status tiket gagal disimpan. Periksa koneksi lalu coba lagi.');
    }
  };

  const savePartUsage = async (part: NonNullable<typeof selectedPart>, amount: number) => {
    if (!ticket.recordId) throw new Error('ID tiket database tidak tersedia. Muat ulang detail tiket.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Quantity harus berupa bilangan bulat lebih dari 0.');
    if (part.stock <= 0) throw new Error('Stok habis. Penggunaan sparepart diblokir.');
    if (amount > part.stock) throw new Error(`Stok tidak cukup. Tersedia ${part.stock} ${part.unit}.`);

    setUsageError('');
    await usageMutation.mutateAsync({ ticket_id: ticket.recordId, part_id: part.id, qty: amount });
  };

  const errorMessage = (error: any) => error?.response?.data?.error ?? error?.message ?? 'Gagal menyimpan pemakaian sparepart.';

  const submitInspection = async () => {
    if (!ticket.recordId || !workType || !diagnosisStatus || !technicianDiagnosis.trim()) {
      setAssessmentError('Pilih jenis pengerjaan dan status diagnosa, lalu isi Hasil Pemeriksaan Teknisi.');
      return;
    }
    if (workType === 'with_parts' && (!primaryPartValid || !Number.isSafeInteger(qty) || qty < 1)) {
      setAssessmentError('Pilih sparepart dan quantity yang valid.');
      return;
    }
    if (extraUnlistedInvalid || !extraLinesValid) {
      setAssessmentError('Lengkapi part tambahan, quantity, dan data part custom.');
      return;
    }

    const common = {
      work_type: workType,
      technician_diagnosis: technicianDiagnosis.trim(),
    };
    try {
      setAssessmentError('');
      if (!needsInspectionQuotation) {
        await inspectionMutation.mutateAsync({
          ticketId: ticket.recordId,
          body: {
            ...common,
            diagnosis_status: 'matches_complaint',
            ...(workType === 'with_parts' ? { part_id: partId, part_qty: qty } : {}),
          },
        });
      } else {
        const labor = Number(laborEstimate || 0);
        if (diagnosisStatus === 'additional_damage' && !hasQuotedPart && labor <= 0) {
          setAssessmentError('Isi kerusakan tambahan dan estimasi jasa atau pilih sparepart untuk quotation.');
          return;
        }
        const items: TicketQuotationInput['items'] = [];
        if (workType === 'with_parts') {
          items.push({
            damage_description: technicianDiagnosis.trim(),
            ...(primaryUnlistedPart
              ? {
                  is_unregistered_part: true,
                  requested_name: unlistedPartName.trim(),
                  specification: unlistedPartSpecification.trim() || undefined,
                  estimated_price: Number(unlistedPartPrice),
                  estimated_part_arrival_days: Number(unlistedPartArrivalDays),
                }
              : { part_id: selectedPart!.id }),
            qty,
            labor_cost: diagnosisStatus === 'additional_damage' ? labor : 0,
          });
        } else if (diagnosisStatus === 'additional_damage') {
          items.push({ damage_description: technicianDiagnosis.trim(), qty: 1, labor_cost: labor });
        }
        for (const line of extraQuotationLines) {
          items.push({
            damage_description: line.damage_description.trim() || technicianDiagnosis.trim(),
            ...(line.is_unregistered_part
              ? {
                  is_unregistered_part: true,
                  requested_name: line.requested_name.trim(),
                  specification: line.specification.trim() || undefined,
                  estimated_price: Number(line.estimated_price),
                  estimated_part_arrival_days: Number(line.estimated_part_arrival_days),
                }
              : line.part_id ? { part_id: line.part_id } : {}),
            qty: line.part_id || line.is_unregistered_part ? line.qty : 1,
            labor_cost: diagnosisStatus === 'additional_damage' ? Number(line.labor_cost || 0) : 0,
          });
        }
        await inspectionMutation.mutateAsync({
          ticketId: ticket.recordId,
          body: {
            ticket_id: ticket.recordId,
            ...common,
            diagnosis_status: diagnosisStatus,
            additional_damage: extraQuotationLines.map((line) => line.damage_description.trim()).join('\n'),
            labor_estimate: diagnosisStatus === 'additional_damage' ? labor : 0,
            items,
          },
        });
      }
    } catch (error) {
      setAssessmentError(errorMessage(error));
    }
  };

  const saveWorkNote = async () => {
    if (!workNote.trim() || !ticket.recordId) return;
    try {
      setWorkNoteError('');
      await workNoteMutation.mutateAsync(workNote.trim());
      setWorkNote('');
    } catch (error) {
      setWorkNoteError(errorMessage(error));
    }
  };

  const addWorkPart = async () => {
    if (!selectedWorkPart) return;
    try {
      await savePartUsage(selectedWorkPart, workPartQty);
      setWorkPartId('');
      setWorkPartQty(1);
    } catch (error) {
      setUsageError(errorMessage(error));
    }
  };

  const saveServiceFee = async () => {
    const fee = Number(parseInventoryNumber(serviceFee) || 0);
    if (!Number.isSafeInteger(fee) || fee < 0) {
      setServiceFeeError('Biaya jasa tidak valid.');
      return;
    }
    setServiceFeeError('');
    try {
      await serviceFeeMutation.mutateAsync(fee);
    } catch (error) {
      setServiceFeeError(errorMessage(error));
    }
  };

  const workPartsTotal = partsUsed.reduce((sum, item) => sum + item.price * item.qty, 0);
  const serviceFeeValue = Number(parseInventoryNumber(serviceFee) || 0);
  const savedServiceFee = Number(workflowTicket?.service_fee ?? 0);
  const deliveryFee = Number(workflowTicket?.pickup_fee ?? 0);
  const finalCostPreview = serviceFeeValue + workPartsTotal + deliveryFee;
  const serverFinalCost = workflowTicket?.final_cost == null
    ? savedServiceFee + workPartsTotal + deliveryFee
    : Number(workflowTicket.final_cost);
  const serviceFeeDirty = serviceFeeValue !== savedServiceFee;
  const approvedWorkQuote = quotation?.status === 'approved' && workflowTicket?.workflow_resolution !== 'continue_original'
    ? quotation
    : null;
  const selectedQuoteItems = (approvedWorkQuote?.items ?? []).filter((item: any) => item.item_type === 'part' && item.part_id === workPartId);
  const netUsedByQuoteItem = new Map<string, number>();
  for (const usage of ticketPartUsagesQuery.data ?? []) {
    if (!usage.quotation_item_id) continue;
    netUsedByQuoteItem.set(
      usage.quotation_item_id,
      (netUsedByQuoteItem.get(usage.quotation_item_id) ?? 0) + Number(usage.net_qty ?? usage.qty)
    );
  }
  let previewQtyRemaining = selectedWorkPart ? workPartQty : 0;
  let pendingPartCost = 0;
  for (const item of selectedQuoteItems) {
    const available = Math.max(0, Number(item.qty) - (netUsedByQuoteItem.get(item.id) ?? 0));
    const allocated = Math.min(previewQtyRemaining, available);
    pendingPartCost += allocated * Number(item.part_unit_price_snapshot ?? item.unit_price ?? 0);
    previewQtyRemaining -= allocated;
  }
  if (selectedWorkPart && !approvedWorkQuote) pendingPartCost = selectedWorkPart.price * workPartQty;
  const pendingPartPreviewReady = !approvedWorkQuote || (
    !ticketPartUsagesQuery.isLoading && !ticketPartUsagesQuery.isError
  );
  const pendingPartIsValid = !selectedWorkPart || !approvedWorkQuote || (
    pendingPartPreviewReady && previewQtyRemaining === 0
  );
  const hasUnsavedCostChanges = serviceFeeDirty || Boolean(selectedWorkPart);

  const saveDiagnosticFee = async () => {
    const fee = Number(diagnosticFee || 0);
    if (!Number.isFinite(fee) || fee < 0) return setDiagnosticFeeError('Biaya diagnosa tidak valid.');
    try {
      setDiagnosticFeeError('');
      await diagnosticFeeMutation.mutateAsync(fee);
    } catch (error) {
      setDiagnosticFeeError(errorMessage(error));
    }
  };

  const partOptionsMessage = inventoryLoading
    ? 'Memuat stok cabang…'
    : inventoryError
      ? 'Gagal memuat stok cabang'
      : parts.length === 0
        ? 'Tidak ada sparepart aktif di cabang ini'
        : 'Pilih sparepart…';
  const workPartOptionsMessage = quoteRequiresApprovedParts && workParts.length === 0
    ? 'Quotation yang disetujui tidak mencakup sparepart'
    : inventoryLoading
      ? 'Memuat stok cabang…'
      : inventoryError
        ? 'Gagal memuat stok cabang'
        : workParts.length === 0
          ? 'Tidak ada sparepart aktif di cabang ini'
          : 'Pilih sparepart…';
  const laborEstimateValue = Number(laborEstimate || 0);
  const assessmentCanSubmit = Boolean(
    ticket?.recordId && workType && diagnosisStatus && technicianDiagnosis.trim() &&
    primaryPartValid &&
    extraLinesValid &&
    (diagnosisStatus !== 'additional_damage' || laborEstimateValue > 0 || hasQuotedPart) &&
    !inspectionMutation.isPending
  );
  const requestedPart = parts.find((part) => part.id === (workflowTicket?.requested_part_id ?? workflowTicket?.requestedPartId)) ?? null;
  const requestedPartQty = Number(workflowTicket?.requested_part_qty ?? workflowTicket?.requestedPartQty ?? 0);
  const currentShortages = workflowTicket?.part_shortages ?? ticket.partShortages ?? [];
  const requestedPartReady = currentWorkType !== 'with_parts' || (
    currentShortages.every((part: any) => Number(part.shortage_qty ?? 0) <= 0) &&
    Boolean(requestedPart && requestedPart.stock >= requestedPartQty)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-black/10 px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-bold outline outline-1',
                STATUS_TONE[ticket.status]
              )}
            >
              {ticket.status}
            </span>
            <span className="font-mono text-xs font-bold text-sky-600">#{ticket.id}</span>
          </div>
          <SheetTitle className="text-xl font-bold text-zinc-900">{ticket.device}</SheetTitle>
          <SheetDescription className="text-sm text-stone-500">
            {ticket.customer} · {ticket.phone} · {ticket.handover}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-6 py-6">
          {inventoryError && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <span>Inventaris cabang gagal dimuat. Coba lagi.</span>
              <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void refetchInventory()}>
                Coba lagi
              </Button>
            </div>
          )}

          {/* SLA + PIN */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-black/10 bg-stone-50 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">PIN / Password unit</p>
              <div className="mt-1 flex items-center justify-between">
                <p className="font-mono text-sm font-bold text-zinc-900">
                  {ticket.pinRefused
                    ? 'Pelanggan menolak memberi PIN'
                    : ticket.devicePin
                      ? showPin ? ticket.devicePin : '••••••'
                      : 'Belum dicatat'}
                </p>
                {ticket.devicePin && !ticket.pinRefused && (
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    className="flex size-7 items-center justify-center rounded-md text-stone-500 transition hover:bg-black/5 hover:text-zinc-900"
                  >
                    {showPin ? <EyeSlash weight="bold" className="size-4" /> : <Eye weight="bold" className="size-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* KELUHAN & DIAGNOSA */}
          <section className="flex flex-col gap-2">
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <NotePencil weight="fill" className="size-4 text-sky-600" /> Keluhan &amp; Diagnosa Awal
            </h4>
            <p className="rounded-xl border border-black/10 bg-stone-50 p-3 text-xs leading-relaxed text-stone-700">
              {ticket.diagnosis}
            </p>
          </section>

          <Separator className="bg-black/10" />

          {/* ACTION PANEL */}
          <section className="flex flex-col gap-4">
            <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
              <Wrench weight="fill" className="size-4 text-sky-600" /> Tindakan
            </h4>

            {statusError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{statusError}</p>}
            {workNoteError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{workNoteError}</p>}
            {statusSaving && <p role="status" className="text-xs text-stone-500">Menyimpan status tiket…</p>}
            {assessmentError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{assessmentError}</p>}
            {ticketDetailQuery.isError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">Detail workflow gagal dimuat. Coba muat ulang tiket.</p>}
            {usageError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{usageError}</p>}
            {usageMutation.isPending && <p role="status" className="text-xs text-stone-500">Menyimpan pemakaian sparepart…</p>}
            {ticketPartUsagesQuery.isError && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <span>Riwayat sparepart gagal dimuat.</span>
                <Button variant="outline" size="sm" className="h-8 shrink-0 text-xs" onClick={() => void ticketPartUsagesQuery.refetch()}>
                  Coba lagi
                </Button>
              </div>
            )}
            {!ticket.recordId && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">ID database tiket tidak tersedia. Muat ulang Kanban sebelum mencatat sparepart.</p>}

            {/* ANTRIAN */}
            {ticket.status === 'Antrian' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs leading-relaxed text-stone-600">
                  Unit berada di antrean. Mulai pengecekan untuk memverifikasi keluhan pelanggan sesuai diagnosa awal.
                </p>
                <Button
                  onClick={() => moveTo('Pengecekan')}
                  disabled={statusSaving}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <ArrowRight weight="bold" className="size-4" /> Pindahkan ke Pengecekan
                </Button>
              </div>
            )}

            {/* PENGECEKAN */}
            {ticket.status === 'Pengecekan' && (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <h5 className="text-xs font-bold text-zinc-900">Keluhan awal pelanggan</h5>
                  <p className="mt-1.5 rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-700">{ticket.diagnosis || 'Tidak ada keluhan tercatat.'}</p>

                  <fieldset className="mt-4">
                    <legend className="text-xs font-bold text-zinc-900">Jenis pengerjaan</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {([
                        ['without_parts', 'Tanpa Sparepart', 'Tidak menggunakan komponen inventory.'],
                        ['with_parts', 'Menggunakan Sparepart', 'Pilih komponen dan quantity yang dibutuhkan.'],
                      ] as const).map(([value, label, description]) => (
                        <label key={value} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors', workType === value ? 'border-sky-500 bg-sky-50' : 'border-stone-200 hover:bg-stone-50')}>
                          <input
                            type="radio"
                            name={`work-type-${ticket.id}`}
                            value={value}
                            checked={workType === value}
                            onChange={() => {
                              setWorkType(value);
                              if (value === 'without_parts') { setPartId(''); setQty(1); }
                              setAssessmentError('');
                            }}
                            className="mt-0.5 size-4 accent-sky-600"
                          />
                          <span>
                            <span className="block text-xs font-bold text-zinc-900">{label}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-stone-600">{description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {workType === 'with_parts' && (
                    <div className="mt-4 grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 sm:grid-cols-[1fr_auto]">
                      <label className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-700">Sparepart yang dibutuhkan</span>
                        <select
                          value={partId}
                          onChange={(event) => {
                            setPartId(event.target.value);
                            setUnlistedPartName('');
                            setUnlistedPartSpecification('');
                            setUnlistedPartPrice('');
                            setUnlistedPartArrivalDays('');
                          }}
                          disabled={inspectionMutation.isPending}
                          className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs text-zinc-900 outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                        >
                          <option value="">{partOptionsMessage}</option>
                          {parts.map((part) => (
                            <option key={part.id} value={part.id}>{part.name} · {part.sku} · stok {part.stock} {part.unit}</option>
                          ))}
                          <option value={UNLISTED_PART}>Sparepart tidak ada di daftar</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-700">Quantity</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={qty}
                          onChange={(event) => setQty(Math.max(1, Number(event.target.value) || 1))}
                          disabled={inspectionMutation.isPending}
                          className="h-10 w-24 rounded-lg border border-stone-300 bg-white px-3 text-xs tabular-nums outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                        />
                      </label>
                      {selectedPart && (
                        <p className={cn('text-[11px] sm:col-span-2', selectedPart.stock < qty ? 'font-semibold text-rose-700' : 'text-stone-600')}>
                          {selectedPart.stock <= 0 ? 'Stok Habis. Tiket akan menunggu part.' : selectedPart.stock < qty ? `Stok kurang (${selectedPart.stock} ${selectedPart.unit}). Tiket akan menunggu part.` : `Stok tersedia: ${selectedPart.stock} ${selectedPart.unit}. Stok baru berkurang saat part benar-benar digunakan.`}
                        </p>
                      )}
                      {primaryUnlistedPart && (
                        <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2 sm:grid-cols-2">
                          <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-700">Nama sparepart *
                            <input value={unlistedPartName} onChange={(event) => setUnlistedPartName(event.target.value.slice(0, 200))} maxLength={200} placeholder="Nama part yang dibutuhkan" className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs font-normal" />
                          </label>
                          <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-700">Estimasi harga part *
                            <input type="number" min={0} value={unlistedPartPrice} onChange={(event) => setUnlistedPartPrice(event.target.value)} placeholder="Contoh: 250000" className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs font-normal tabular-nums" />
                          </label>
                          <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-700">Spesifikasi / keterangan
                            <input value={unlistedPartSpecification} onChange={(event) => setUnlistedPartSpecification(event.target.value.slice(0, 2000))} maxLength={2000} placeholder="Tipe, kode, merek" className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs font-normal" />
                          </label>
                          <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-700">Estimasi kedatangan (hari) *
                            <input type="number" min={1} step={1} value={unlistedPartArrivalDays} onChange={(event) => setUnlistedPartArrivalDays(event.target.value)} placeholder="Contoh: 7" className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-xs font-normal tabular-nums" />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <fieldset>
                    <legend className="text-xs font-bold text-zinc-900">Hasil diagnosa</legend>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      {([
                        ['matches_complaint', 'Sesuai keluhan awal pelanggan'],
                        ['additional_damage', 'Ditemukan kerusakan tambahan'],
                      ] as const).map(([value, label]) => (
                        <label key={value} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors', diagnosisStatus === value ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-stone-200 text-stone-700 hover:bg-stone-50')}>
                          <input
                            type="radio"
                            name={`diagnosis-status-${ticket.id}`}
                            value={value}
                            checked={diagnosisStatus === value}
                            onChange={() => { setDiagnosisStatus(value); setAssessmentError(''); }}
                            className="size-4 accent-sky-600"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="mt-4 flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-stone-700">Hasil Pemeriksaan Teknisi</span>
                    <textarea
                      value={technicianDiagnosis}
                      onChange={(event) => setTechnicianDiagnosis(event.target.value.slice(0, 4000))}
                      rows={4}
                      maxLength={4000}
                      placeholder="Contoh: IC charging rusak akibat korsleting, ada korosi di area power. Perlu ganti IC dan bersihkan korosi."
                      className="w-full resize-y rounded-lg border border-stone-300 bg-white p-3 text-xs leading-5 outline-none placeholder:text-stone-400 focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                    />
                    <span className="text-[11px] leading-5 text-stone-500">Isi ini akan terlihat oleh pelanggan di quotation.</span>
                  </label>

                  {(diagnosisStatus === 'additional_damage' || workType === 'with_parts') && (
                    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                      {diagnosisStatus === 'additional_damage' && <label className="flex max-w-xs flex-col gap-1.5">
                        <span className="text-[11px] font-semibold text-stone-700">Estimasi biaya jasa tambahan</span>
                        <span className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">Rp</span>
                          <input
                            type="number"
                            min={0}
                            step={1000}
                            value={laborEstimate}
                            onChange={(event) => setLaborEstimate(event.target.value)}
                            className="h-10 w-full rounded-lg border border-stone-300 bg-white pl-9 pr-3 text-xs tabular-nums outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                          />
                        </span>
                      </label>}
                      {extraQuotationLines.map((line, index) => (
                        <div key={index} className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-stone-700">{diagnosisStatus === 'additional_damage' ? `Item quotation #${index + 2}` : `Part tambahan #${index + 1}`}</span>
                            <button
                              type="button"
                              aria-label={`Hapus kerusakan ${index + 2}`}
                              onClick={() => setExtraQuotationLines((lines) => lines.filter((_, row) => row !== index))}
                              className="rounded-md p-1 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            ><Trash className="size-4" /></button>
                          </div>
                          {diagnosisStatus === 'additional_damage' && <input
                            value={line.damage_description}
                            onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, damage_description: event.target.value.slice(0, 1000) } : row))}
                            maxLength={1000}
                            placeholder="Nama kerusakan"
                            className="h-10 rounded-lg border border-stone-300 px-3 text-xs outline-none focus-visible:border-sky-600 focus-visible:ring-2 focus-visible:ring-sky-600/20"
                          />}
                          <div className="grid gap-2 sm:grid-cols-2">
                            {workType === 'with_parts' && (
                              <select
                                value={line.part_id}
                                onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, part_id: event.target.value, is_unregistered_part: event.target.value === UNLISTED_PART } : row))}
                                className="h-10 min-w-0 rounded-lg border border-stone-300 bg-white px-3 text-xs outline-none focus-visible:border-sky-600"
                              >
                                <option value="">{diagnosisStatus === 'additional_damage' ? 'Jasa saja (tanpa part)' : 'Pilih part'}</option>
                                {parts.map((part) => <option key={part.id} value={part.id}>{part.name} · stok {part.stock}</option>)}
                                <option value={UNLISTED_PART}>Sparepart tidak ada di daftar</option>
                              </select>
                            )}
                            {diagnosisStatus === 'additional_damage' && <label className="flex items-center gap-2 text-[11px] text-stone-600">
                              Biaya jasa
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={line.labor_cost}
                                onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, labor_cost: event.target.value } : row))}
                                className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-xs tabular-nums outline-none focus-visible:border-sky-600"
                              />
                            </label>}
                          </div>
                          {line.is_unregistered_part && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <input value={line.requested_name} onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, requested_name: event.target.value.slice(0, 200) } : row))} maxLength={200} placeholder="Nama sparepart *" className="h-9 rounded-lg border border-stone-300 px-3 text-xs" />
                              <input value={line.specification} onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, specification: event.target.value.slice(0, 2000) } : row))} maxLength={2000} placeholder="Spesifikasi / keterangan (opsional)" className="h-9 rounded-lg border border-stone-300 px-3 text-xs" />
                              <input type="number" min={0} value={line.estimated_price} onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, estimated_price: event.target.value } : row))} placeholder="Estimasi harga part *" className="h-9 rounded-lg border border-stone-300 px-3 text-xs tabular-nums" />
                              <input type="number" min={1} step={1} value={line.estimated_part_arrival_days} onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, estimated_part_arrival_days: event.target.value } : row))} placeholder="Estimasi kedatangan (hari) *" className="h-9 rounded-lg border border-stone-300 px-3 text-xs tabular-nums" />
                            </div>
                          )}
                          {workType === 'with_parts' && line.part_id && (
                            <label className="flex items-center gap-2 text-[11px] text-stone-600">
                              Quantity
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={line.qty}
                                onChange={(event) => setExtraQuotationLines((lines) => lines.map((row, i) => i === index ? { ...row, qty: Math.max(1, Number(event.target.value) || 1) } : row))}
                                className="h-9 w-24 rounded-lg border border-stone-300 bg-white px-3 text-xs tabular-nums"
                              />
                            </label>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setExtraQuotationLines((lines) => [...lines, { damage_description: '', part_id: '', is_unregistered_part: false, requested_name: '', specification: '', qty: 1, estimated_price: '', estimated_part_arrival_days: '', labor_cost: '0' }])}
                        className="h-9 self-start gap-1.5 text-[11px] font-semibold"
                      ><Plus className="size-3.5" /> {diagnosisStatus === 'additional_damage' ? 'Tambah item quotation' : 'Tambah part'}</Button>
                      <p className="text-[11px] leading-5 text-stone-600">
                        Sparepart yang dipilih akan masuk quotation. Inventory tidak berkurang sebelum pelanggan menyetujui dan teknisi mencatat pemakaian.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={submitInspection}
                    disabled={!assessmentCanSubmit || (needsInventoryData && (inventoryLoading || inventoryError))}
                    className="mt-4 h-11 w-full gap-2 text-sm font-bold"
                  >
                    {inspectionMutation.isPending ? <Clock weight="bold" /> : needsInspectionQuotation ? <PaperPlaneTilt weight="bold" /> : <ArrowRight weight="bold" />}
                    {inspectionMutation.isPending ? 'Menyimpan…' : needsInspectionQuotation ? 'Kirim quotation untuk persetujuan' : selectedPart && selectedPart.stock < qty ? 'Simpan diagnosa · Menunggu Part' : 'Simpan diagnosa & lanjut ke Pengerjaan'}
                  </Button>
                  {needsInspectionQuotation && inspectionMutation.data?.notification_status === 'queued' && (
                    <div role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      Quotation tersimpan. Pengiriman WhatsApp sedang diproses.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MENUNGGU PERSETUJUAN */}
            {ticket.status === 'Menunggu Persetujuan' && (
              <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-white p-4">
                <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3">
                  <Clock weight="fill" className="mt-0.5 size-4 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">
                       {quotation?.status === 'rejected' ? 'Pelanggan menolak quotation' : quotation?.status === 'draft' ? 'Quotation belum terkirim' : 'Menunggu persetujuan pelanggan'}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-amber-900/80">
                       {quotation?.status === 'rejected'
                         ? quotation.decision_note || 'Pilih langkah berikutnya untuk tiket ini.'
                         : quotation?.status === 'draft'
                           ? 'Quotation belum terkirim. Admin perlu menindaklanjuti sebelum pelanggan dapat menyetujui.'
                           : 'Sparepart belum digunakan dan stok inventory belum berkurang.'}
                    </p>
                  </div>
                  {quotation && <span className="ml-auto rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-amber-800">{quotation.status}</span>}
                </div>

                {quotation?.items?.length > 0 && (
                  <div>
                    {quotation.technician_diagnosis_snapshot && (
                      <p className="mb-3 whitespace-pre-wrap rounded-lg bg-stone-50 p-3 text-xs leading-5 text-stone-700">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-stone-500">Hasil Pemeriksaan Teknisi</span>
                        {quotation.technician_diagnosis_snapshot}
                      </p>
                    )}
                    <h5 className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Rincian quotation</h5>
                    <ul className="mt-2 divide-y divide-stone-100 rounded-lg border border-stone-200 px-3">
                      {quotation.items.map((item: any) => (
                        <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                          <span className="min-w-0">
                            <span className="block font-semibold text-zinc-900">{item.part_name || item.description}{item.item_type === 'part' && item.part_is_registered === false ? ' · Part perlu dipesan' : ''}</span>
                            <span className="text-[10px] text-stone-500">{item.damage_description || item.description} · {item.item_type === 'part' ? 'Sparepart' : 'Jasa'} · Qty {item.qty}</span>
                            {item.part_specification_snapshot && <span className="block text-[10px] text-stone-500">{item.part_specification_snapshot}</span>}
                            {item.availability_status && <span className="block text-[10px] font-semibold text-amber-800">{item.availability_status} · stok snapshot {item.available_qty_snapshot}{item.estimated_part_arrival_days ? ` · estimasi datang ${item.estimated_part_arrival_days} hari` : ''}</span>}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">Rp {angka(Number(item.subtotal))}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-right text-sm font-bold tabular-nums text-zinc-900">Total · Rp {angka(Number(quotation.total_amount))}</p>
                  </div>
                )}

                {quotation?.status === 'sent' && (
                  <p className="text-xs leading-5 text-stone-600">
                    Menunggu keputusan pelanggan melalui tautan WhatsApp. Pemakaian inventory baru dapat dicatat setelah disetujui.
                  </p>
                )}

                {currentRole === 'admin' && quotation && ['draft', 'sent'].includes(quotation.status) && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold text-rose-800">{quotation.notification?.status === 'queued' ? 'Pengiriman WhatsApp sedang diproses.' : quotation.status === 'draft' ? 'Quotation belum terkirim ke pelanggan.' : 'Kirim ulang quotation dengan tautan approval baru.'}</p>
                    {quotation.notification?.status === 'failed' && <p role="alert" className="mt-2 text-xs leading-5 text-rose-800">WhatsApp gagal dikirim: {quotation.notification.error_message || 'penyedia notifikasi tidak tersedia.'}</p>}
                    {quotation.notification?.approval_url && <a href={quotation.notification.approval_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-sky-800 underline underline-offset-2"><ArrowSquareOut weight="bold" className="size-3.5" /> Buka link approval untuk pengujian</a>}
                    {retryQuotationMutation.isError && <p role="alert" className="mt-2 text-xs text-rose-700">{errorMessage(retryQuotationMutation.error)}</p>}
                    <Button
                      variant="outline"
                      disabled={retryQuotationMutation.isPending || quotation.notification?.status === 'queued'}
                      onClick={() => retryQuotationMutation.mutate(quotation.id)}
                      className="mt-2 h-9 gap-2 text-xs font-semibold"
                    ><PaperPlaneTilt weight="bold" /> {retryQuotationMutation.isPending || quotation.notification?.status === 'queued' ? 'Mengirim…' : 'Kirim ulang WhatsApp'}</Button>
                  </div>
                )}

                {currentRole === 'admin' && quotation && ['draft', 'sent'].includes(quotation.status) && quotation.notification?.status !== 'queued' && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <p className="text-xs font-semibold text-sky-900">Persetujuan manual (telepon / tatap muka)</p>
                    <textarea
                      value={manualApprovalNote}
                      onChange={(event) => setManualApprovalNote(event.target.value.slice(0, 500))}
                      rows={2}
                      maxLength={500}
                      placeholder="Catatan wajib: sumber persetujuan dan ringkasan konfirmasi pelanggan"
                      className="mt-2 w-full resize-y rounded-lg border border-sky-200 bg-white p-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-600/20"
                    />
                    {manualApprovalError && <p role="alert" className="mt-2 text-xs text-rose-700">{manualApprovalError}</p>}
                    {manualDecisionMutation.isError && <p role="alert" className="mt-2 text-xs text-rose-700">{errorMessage(manualDecisionMutation.error)}</p>}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Button variant="outline" disabled={!manualApprovalNote.trim() || manualDecisionMutation.isPending} onClick={() => { setManualApprovalError(''); manualDecisionMutation.mutate('rejected'); }} className="h-9 text-xs text-rose-700">Tolak · Manual</Button>
                      <Button disabled={!manualApprovalNote.trim() || manualDecisionMutation.isPending} onClick={() => { setManualApprovalError(''); manualDecisionMutation.mutate('approved'); }} className="h-9 text-xs">Setujui · Manual</Button>
                    </div>
                  </div>
                )}

                {quotation?.status === 'rejected' && (
                  <div className="flex flex-col gap-2 border-t border-stone-200 pt-3">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <label className="block text-[11px] font-semibold text-stone-700">Biaya cek / diagnosa (opsional)
                        <input type="number" min={0} step={1000} value={diagnosticFee} onChange={(event) => setDiagnosticFee(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-xs tabular-nums" />
                      </label>
                      <p className="mt-1 text-[10px] leading-4 text-stone-600">Biaya ini ditagihkan hanya jika servis dibatalkan. Jika lanjut sesuai keluhan awal, nilainya tetap tersimpan untuk audit tetapi tidak masuk total.</p>
                      {diagnosticFeeError && <p role="alert" className="mt-1 text-[11px] text-rose-700">{diagnosticFeeError}</p>}
                      <Button variant="outline" disabled={diagnosticFeeMutation.isPending} onClick={saveDiagnosticFee} className="mt-2 h-8 text-[11px]">{diagnosticFeeMutation.isPending ? 'Menyimpan…' : 'Simpan biaya diagnosa'}</Button>
                    </div>
                    {rejectionResolutionMutation.isError && <p role="alert" className="text-xs text-rose-700">{errorMessage(rejectionResolutionMutation.error)}</p>}
                    <Button
                      variant="outline"
                      disabled={rejectionResolutionMutation.isPending}
                      onClick={() => rejectionResolutionMutation.mutate('continue_original')}
                      className="h-auto min-h-10 justify-start whitespace-normal text-left text-xs"
                    >
                      <ArrowRight weight="bold" className="size-4 shrink-0" /> Lanjut hanya sesuai keluhan awal (jika memungkinkan)
                    </Button>
                    <Button
                      variant="outline"
                      disabled={rejectionResolutionMutation.isPending}
                      onClick={() => rejectionResolutionMutation.mutate('cancel_and_return')}
                      className="h-auto min-h-10 justify-start whitespace-normal text-left text-xs text-rose-700 hover:bg-rose-50"
                    >
                      <XCircle weight="bold" className="size-4 shrink-0" /> Batalkan servis &amp; kembalikan perangkat
                    </Button>
                  </div>
                )}
                {rejectionResolutionMutation.isPending && <p role="status" className="text-xs text-stone-500">Menyimpan keputusan teknisi…</p>}
              </div>
            )}

            {/* MENUNGGU PART */}
            {ticket.status === 'Menunggu Part' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Clock weight="fill" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-800">Menunggu sparepart</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
                      {quotation?.status === 'approved'
                        ? 'Pelanggan sudah menyetujui quotation. Stok belum cukup; pengerjaan dapat dimulai setelah part tersedia.'
                        : 'Sparepart yang dipilih belum tersedia di cabang tiket.'}
                    </p>
                  </div>
                </div>
                {requestedPart && <p className="text-xs text-stone-700">{requestedPart.name} · Qty {requestedPartQty} · stok saat ini {requestedPart.stock} {requestedPart.unit}</p>}
                {!!(workflowTicket?.part_shortages?.length || ticket.partShortages?.length) && (
                  <ul className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    {currentShortages.map((part: any) => (
                      <li key={part.part_request_id ?? part.part_id}>
                        {part.part_name}: kurang {part.shortage_qty} (tersedia {part.available_qty}/{part.required_qty})
                        {part.part_request_status && <span className="ml-1 font-semibold">· {part.part_request_status}</span>}
                        {part.estimated_arrival_days && <span className="ml-1">· estimasi {part.estimated_arrival_days} hari</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {inventoryError && <p role="alert" className="text-xs text-rose-700">Gagal memuat stok cabang. Coba muat ulang detail tiket.</p>}
                <Button
                  onClick={() => moveTo('Pengerjaan')}
                  disabled={statusSaving || inventoryLoading || inventoryError || !requestedPartReady}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <Package weight="bold" className="size-4" /> {requestedPartReady ? 'Part tersedia → Mulai Pengerjaan' : 'Menunggu stok tersedia'}
                </Button>
              </div>
            )}

            {/* PENGERJAAN */}
            {ticket.status === 'Pengerjaan' && (
              <div className="flex flex-col gap-4">
                {currentWorkType === 'without_parts' ? (
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Tanpa Sparepart</p>
                      <p className="mt-1 text-[11px] leading-5 text-emerald-900/80">Pengerjaan berjalan tanpa mengubah stok inventory.</p>
                    </div>
                  </div>
                ) : (
                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-zinc-900">Sparepart yang digunakan</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                        Tambahkan satu atau lebih sparepart yang dipasang pada unit ini.
                      </p>
                    </div>
                    {partsUsed.length > 0 && (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
                        {partsUsed.length} pemakaian
                      </span>
                    )}
                  </div>

                  {ticketPartUsagesQuery.isLoading ? (
                    <p className="mt-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">Memuat sparepart terpakai…</p>
                  ) : partsUsed.length > 0 ? (
                    <ul className="mt-3 flex flex-col gap-2">
                      {partsUsed.map((item, idx) => (
                        <li
                          key={`${item.id}-${idx}`}
                          className="flex items-center gap-3 rounded-lg border border-black/10 bg-stone-50 p-3"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-zinc-900">{item.name}</span>
                            <span className="block font-mono text-[10px] text-stone-400">
                              {item.sku ?? item.id} · Qty {item.qty} {item.unit ?? 'pcs'} · {item.usedBy ?? technician}
                            </span>
                            {item.usedAt && <span className="block text-[10px] text-stone-400">{new Date(item.usedAt).toLocaleString('id-ID')}</span>}
                          </span>
                          <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-900">
                            Rp {angka(item.price * item.qty)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                      Belum ada sparepart dicatat. Tambahkan di bawah.
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-black/5 pt-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="flex min-w-0 flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Tambah sparepart</span>
                      <select
                        value={workPartId}
                        onChange={(e) => setWorkPartId(e.target.value)}
                        disabled={inventoryLoading || inventoryError || workParts.length === 0}
                        className="h-10 w-full min-w-0 truncate rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <option value="">{workPartOptionsMessage}</option>
                        {workParts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name} · {part.sku} · {inventoryStockStatus(part.stock, part.minStock)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold text-stone-600">Qty</span>
                      <input
                        type="number"
                        min={1}
                        max={selectedWorkPart?.stock}
                        value={workPartQty}
                        onChange={(e) => setWorkPartQty(Math.max(1, Number(e.target.value) || 1))}
                        className="h-10 w-20 rounded-lg border border-black/10 bg-stone-100 px-3 text-xs font-medium tabular-nums text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </label>
                    <div className="flex items-end">
                      <Button
                        onClick={addWorkPart}
                        disabled={!selectedWorkPart || !ticket.recordId || usageMutation.isPending || selectedWorkPart.stock <= 0 || workPartQty > selectedWorkPart.stock || !pendingPartIsValid}
                        className="h-10 w-full gap-2 bg-sky-600 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50 sm:w-auto"
                      >
                        <Plus weight="bold" className="size-4" /> {usageMutation.isPending ? 'Menyimpan…' : 'Simpan penggunaan'}
                      </Button>
                    </div>
                  </div>

                  {selectedWorkPart && (
                    <p className={cn('mt-2 text-[11px]', selectedWorkPart.stock < workPartQty ? 'font-semibold text-rose-700' : 'text-stone-500')}>
                      {selectedWorkPart.stock <= 0 ? 'Stok Habis' : selectedWorkPart.stock < workPartQty ? 'Stok tidak cukup' : `Stok ${inventoryStockStatus(selectedWorkPart.stock, selectedWorkPart.minStock)}`} · {selectedWorkPart.stock} {selectedWorkPart.unit} · {selectedWorkPart.bin}
                    </p>
                  )}

                  {partsUsed.length > 0 && (
                    <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
                      <span className="text-[11px] font-semibold text-stone-600">Total nilai sparepart</span>
                      <span className="text-xs font-bold tabular-nums text-zinc-900">Rp {angka(workPartsTotal)}</span>
                    </div>
                  )}
                </div>
                )}

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs font-bold text-zinc-900">Biaya final servis</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-stone-600">
                    Total mengikuti jasa yang disimpan, pemakaian sparepart tersimpan, dan delivery.
                  </p>
                  <label className="mt-3 flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-stone-600">Biaya jasa teknisi</span>
                    <span className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-500">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={serviceFee}
                        onChange={(event) => {
                          const digits = parseInventoryNumber(event.target.value);
                          setServiceFee(digits ? angka(Number(digits)) : '');
                        }}
                        className="h-10 w-full rounded-lg border border-black/10 bg-stone-50 pl-9 pr-3 text-xs tabular-nums text-zinc-900 outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                      />
                    </span>
                  </label>
                  {hasUnsavedCostChanges && (
                    <p role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                      Belum disimpan: {serviceFeeDirty && selectedWorkPart ? 'biaya jasa dan pemakaian sparepart' : serviceFeeDirty ? 'biaya jasa' : 'pemakaian sparepart'}.
                    </p>
                  )}
                  <div className="mt-3 flex flex-col gap-1 border-t border-black/5 pt-3 text-xs">
                    <div className="flex justify-between gap-3 text-stone-600">
                      <span>Biaya jasa teknisi</span>
                      <span className="font-semibold tabular-nums text-zinc-900">Rp {angka(serviceFeeValue)}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-stone-600">
                      <span>Sparepart tersimpan</span>
                      <span className="font-semibold tabular-nums text-zinc-900">Rp {angka(workPartsTotal)}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-stone-600">
                      <span>Delivery</span>
                      <span className="font-semibold tabular-nums text-zinc-900">Rp {angka(deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between gap-3 font-bold text-zinc-900">
                      <span>Total pratinjau</span>
                      <span className="tabular-nums">Rp {angka(finalCostPreview)}</span>
                    </div>
                  </div>
                  {selectedWorkPart && (
                    <p className={cn('mt-2 rounded-lg px-3 py-2 text-[11px]', pendingPartIsValid ? 'bg-sky-50 text-sky-900' : 'bg-rose-50 text-rose-800')}>
                      {pendingPartIsValid
                        ? `${selectedWorkPart.name}: + Rp ${angka(pendingPartCost)} setelah pemakaian disimpan. Belum masuk total di atas.`
                        : pendingPartPreviewReady
                          ? 'Quantity melebihi sisa part pada quotation yang disetujui.'
                          : 'Riwayat pemakaian quotation belum termuat; pratinjau harga menunggu data tersimpan.'}
                    </p>
                  )}
                  {Math.round(serverFinalCost) !== Math.round(finalCostPreview) && (
                    <p className="mt-2 text-[10px] text-stone-500">Total yang masih tersimpan di server: Rp {angka(serverFinalCost)}</p>
                  )}
                  {serviceFeeError && <p role="alert" className="mt-2 text-xs text-rose-700">{serviceFeeError}</p>}
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={saveServiceFee}
                      disabled={serviceFeeMutation.isPending || !serviceFeeDirty}
                      variant="outline"
                      className="h-9 gap-2 text-xs font-bold text-stone-700 disabled:opacity-50"
                    >
                      <Plus weight="bold" className="size-3.5" /> {serviceFeeMutation.isPending ? 'Menyimpan...' : 'Simpan biaya jasa'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white p-4">
                  <p className="text-xs font-bold text-zinc-900">Catatan teknisi pengerjaan</p>
                  <textarea
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value.slice(0, 400))}
                    rows={3}
                    placeholder="Tulis hasil pengerjaan: komponen yang diganti, hasil uji, catatan penting..."
                    className="mt-2 w-full resize-none rounded-lg border border-black/10 bg-stone-50 p-3 text-xs text-zinc-900 outline-none placeholder:text-stone-400 focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      onClick={saveWorkNote}
                      disabled={!workNote.trim() || workNoteMutation.isPending || !ticket.recordId}
                      variant="outline"
                      className="h-9 gap-2 text-xs font-bold text-stone-700 disabled:opacity-50"
                    >
                      <Plus weight="bold" className="size-3.5" /> {workNoteMutation.isPending ? 'Menyimpan…' : 'Simpan catatan'}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => moveTo('Quality Control')}
                  disabled={statusSaving}
                  className="h-11 w-full gap-2 bg-sky-600 text-sm font-bold text-white hover:bg-sky-700"
                >
                  <ShieldCheck weight="bold" className="size-4" /> Pindahkan ke Quality Check
                </Button>
              </div>
            )}

            {/* QUALITY CONTROL */}
            {ticket.status === 'Quality Control' && (
              <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4">
                <p className="text-xs font-bold text-zinc-900">Hasil pengujian fungsi perangkat</p>
                <p className="text-[11px] leading-relaxed text-stone-600">
                  Uji apakah perangkat berjalan normal. Jika masih bermasalah, kembalikan ke pengerjaan.
                </p>
                <div className="mt-1 flex flex-col gap-2">
                  <Button
                    onClick={() => moveTo('Selesai')}
                    disabled={statusSaving}
                    className="h-11 w-full gap-2 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle weight="bold" className="size-4" /> Berjalan normal → Selesai
                  </Button>
                  <Button
                    onClick={() => moveTo('Pengerjaan')}
                    disabled={statusSaving}
                    variant="outline"
                    className="h-11 w-full gap-2 text-sm font-bold text-rose-700"
                  >
                    <ArrowUUpLeft weight="bold" className="size-4" /> Masih bermasalah → Kembali ke Pengerjaan
                  </Button>
                </div>
              </div>
            )}

            {/* SELESAI */}
            {ticket.status === 'Selesai' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle weight="fill" className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-emerald-800">Pengerjaan selesai</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-900/80">
                    {ticket.slaTertiary ?? 'Unit lolos quality check dan siap diserahkan ke pelanggan.'}
                  </p>
                </div>
              </div>
            )}
            {ticket.status === 'Dibatalkan' && (
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-bold text-stone-800">Servis dibatalkan</p>
                <p className="mt-1 text-[11px] text-stone-600">Biaya cek / diagnosa: Rp {angka(Number(diagnosticFee || 0))}</p>
                <label className="mt-3 block text-[11px] font-semibold text-stone-700">Biaya cek / diagnosa (opsional)
                  <input type="number" min={0} step={1000} value={diagnosticFee} onChange={(event) => setDiagnosticFee(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-xs tabular-nums" />
                </label>
                {diagnosticFeeError && <p role="alert" className="mt-1 text-[11px] text-rose-700">{diagnosticFeeError}</p>}
                <Button variant="outline" disabled={diagnosticFeeMutation.isPending} onClick={saveDiagnosticFee} className="mt-2 h-8 text-[11px]">Simpan biaya diagnosa</Button>
                <Button onClick={() => moveTo('Siap Diambil')} disabled={statusSaving} className="mt-2 h-9 w-full text-xs">Perangkat siap dikembalikan</Button>
              </div>
            )}
            {ticket.status === 'Siap Diambil' && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-bold text-violet-900">Perangkat siap diambil / dikembalikan</p>
                {workflowTicket?.workflow_resolution === 'cancel_and_return' && <p className="mt-1 text-[11px] text-violet-800">Biaya cek / diagnosa: Rp {angka(Number(diagnosticFee || 0))}</p>}
              </div>
            )}
          </section>

          {/* PARTS USED (ringkasan — disembunyikan saat Pengerjaan karena sudah dikelola di panel tindakan) */}
          {ticket.status !== 'Pengerjaan' && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <Package weight="fill" className="size-4 text-sky-600" /> Sparepart Terpakai
              </h4>
              {ticketPartUsagesQuery.isLoading ? (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">Memuat riwayat sparepart…</p>
              ) : partsUsed.length > 0 ? (
                <ul className="flex flex-col divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10 bg-white">
                  {partsUsed.map((item, idx) => (
                    <li key={`${item.id}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-zinc-900">{item.name}</span>
                        <span className="block font-mono text-[10px] text-stone-400">
                          {item.sku ?? item.id} · Qty {item.qty} {item.unit ?? 'pcs'} · {item.usedBy ?? technician}
                        </span>
                        {item.usedAt && <span className="block text-[10px] text-stone-400">{new Date(item.usedAt).toLocaleString('id-ID')}</span>}
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-900">
                        Rp {angka(item.price * item.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-3 text-center text-[11px] text-stone-500">
                  Belum ada sparepart yang dicatat.
                </p>
              )}
            </section>
          )}

          {/* QUOTATION (OUT OF STOCK) */}
          {ticket.quotation?.type === 'PART_OUT_OF_STOCK' && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <PaperPlaneTilt weight="fill" className="size-4 text-sky-600" /> Quotation Pembelian Sparepart
              </h4>
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800">{ticket.quotation.message}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {ticket.quotation.status === 'PENDING' ? 'Menunggu approval' : ticket.quotation.status}
                  </span>
                </div>
                {ticket.quotation.etaDays && (
                  <p className="mt-1.5 text-[11px] text-amber-900/80">
                    Estimasi kedatangan: {ticket.quotation.etaDays} hari kerja · dikirim {ticket.quotation.createdAt}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* NOTES */}
          {ticket.notes && ticket.notes.length > 0 && (
            <section className="flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <NotePencil weight="fill" className="size-4 text-sky-600" /> Riwayat Catatan Teknisi
              </h4>
              <ol className="flex flex-col gap-2">
                {ticket.notes.map((entry, idx) => (
                  <li key={idx} className="rounded-xl border border-black/10 bg-white p-3">
                    <span className="block text-[10px] font-semibold text-stone-400">{entry.at}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-700">{entry.note}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* PHOTOS */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <Camera weight="fill" className="size-4 text-sky-600" /> Foto Bukti &amp; Progress
              </h4>
              <Button variant="outline" size="sm" className="h-auto gap-1.5 px-2.5 py-1 text-[11px] font-medium text-stone-700">
                <Plus weight="bold" className="size-3.5 text-neutral-500" /> Upload foto
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Check-in', 'Progress', 'Final QC'].map((label) => (
                <div
                  key={label}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-400"
                >
                  <Camera className="size-5" />
                  <span className="text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </section>

          {ticket.status === 'Selesai' && (
            <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-stone-50 p-3 text-[11px] text-stone-500">
              <Trash weight="bold" className="size-3.5" /> Data tersimpan permanen untuk audit &amp; garansi.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
