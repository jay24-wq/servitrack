import type { Knex } from 'knex';
import {
  createAssignmentLog,
  findActiveTechnician,
  findLeastLoadedTechnician,
  listTechnicianWorkload,
  type AssignmentType,
  type TechnicianWorkload,
} from '@repositories/ticketAssignmentRepo';

export interface ManualAssignmentInput {
  tenantId: string;
  branchId: string;
  ticketId: string;
  technicianId: string;
  assignedBy: string;
  actorName?: string;
  actorRole?: string;
  note?: string;
  nextStatus?: string;
}

export interface ManualAssignmentResult {
  ticket: any;
  fromTechnician: { id: string; name: string } | null;
  toTechnician: TechnicianWorkload;
  note: string;
}

function serviceError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function actorRoleLabel(role?: string) {
  const normalized = (role ?? '').toLowerCase();
  if (normalized === 'frontdesk') return 'Frontdesk';
  if (normalized === 'admin') return 'Admin';
  return 'Pengguna';
}

function cleanNote(note?: string) {
  const value = String(note ?? '').trim();
  return value ? value.slice(0, 500) : null;
}

export async function pickAutoTechnician(trx: Knex.Transaction, tenantId: string, branchId: string) {
  await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', [`ticket-auto-assign:${branchId}`]);
  return findLeastLoadedTechnician(trx, tenantId, branchId);
}

export async function logAutomaticAssignment(
  trx: Knex.Transaction,
  input: { tenantId: string; ticketId: string; technician: TechnicianWorkload }
) {
  const note = `Ticket otomatis ditugaskan ke Teknisi ${input.technician.name} berdasarkan beban kerja terendah.`;
  await createAssignmentLog(trx, {
    tenant_id: input.tenantId,
    ticket_id: input.ticketId,
    to_technician_id: input.technician.id,
    assignment_type: 'AUTO',
    note,
    meta: {
      active_count: input.technician.active_count,
      total_count: input.technician.total_count,
      last_assigned_at: input.technician.last_assigned_at,
    },
  });
  return note;
}

export async function logExplicitAssignment(
  trx: Knex.Transaction,
  input: {
    tenantId: string;
    ticketId: string;
    technician: TechnicianWorkload;
    assignedBy?: string | null;
    actorName?: string;
    actorRole?: string;
  }
) {
  const actorName = input.actorName?.trim() || 'Pengguna';
  const note = `Teknisi ${input.technician.name} ditugaskan manual oleh ${actorRoleLabel(
    input.actorRole
  )} (${actorName}) saat tiket dibuat.`;
  await createAssignmentLog(trx, {
    tenant_id: input.tenantId,
    ticket_id: input.ticketId,
    to_technician_id: input.technician.id,
    assignment_type: 'MANUAL',
    assigned_by: input.assignedBy ?? null,
    note,
  });
  return note;
}

export async function assignTechnicianManually(
  trx: Knex.Transaction,
  input: ManualAssignmentInput
): Promise<ManualAssignmentResult> {
  const tenantId = input.tenantId;
  const technician = await findActiveTechnician(trx, tenantId, input.technicianId, input.branchId);
  if (!technician) {
    throw serviceError('Teknisi tidak ditemukan atau tidak aktif', 400);
  }

  const ticket = await trx('service_tickets')
    .where({ id: input.ticketId, tenant_id: tenantId, branch_id: input.branchId })
    .forUpdate()
    .first();
  if (!ticket) {
    throw serviceError('Tiket tidak ditemukan', 404);
  }

  if (ticket.technician_id === technician.id) {
    throw serviceError('Teknisi tersebut sudah ditugaskan pada tiket ini', 409);
  }

  const fromTechnician = ticket.technician_id
    ? await trx('users')
        .where({ id: ticket.technician_id, tenant_id: tenantId })
        .select('id', 'name')
        .first()
    : null;

  const actor = await trx('users')
    .where({ id: input.assignedBy, tenant_id: tenantId })
    .select('id', 'name')
    .first();
  const actorName = actor?.name || input.actorName?.trim() || 'Pengguna';
  const reason = cleanNote(input.note);
  const assignedAt = new Date();

  const updateData: Record<string, unknown> = {
    technician_id: technician.id,
    assignment_type: 'MANUAL' satisfies AssignmentType,
    assigned_at: assignedAt,
    assigned_by: input.assignedBy,
  };
  if (input.nextStatus) updateData.current_status = input.nextStatus;

  const [updated] = await trx('service_tickets')
    .where({ id: input.ticketId, tenant_id: tenantId, branch_id: input.branchId })
    .update(updateData)
    .returning('*');

  const baseNote = `Teknisi diubah dari ${fromTechnician?.name ?? 'Belum Ditugaskan'} menjadi ${
    technician.name
  } oleh ${actorRoleLabel(input.actorRole)} (${actorName}).`;
  const note = reason ? `${baseNote} Alasan: ${reason}.` : baseNote;

  await createAssignmentLog(trx, {
    tenant_id: tenantId,
    ticket_id: input.ticketId,
    from_technician_id: ticket.technician_id,
    to_technician_id: technician.id,
    assignment_type: 'MANUAL',
    assigned_by: input.assignedBy,
    note,
    meta: {
      reason,
      active_count: technician.active_count,
      last_assigned_at: technician.last_assigned_at,
      previous_assignment_type: ticket.assignment_type ?? null,
    },
  });

  if (input.nextStatus && input.nextStatus !== ticket.current_status) {
    await trx('ticket_status_logs').insert({
      tenant_id: tenantId,
      ticket_id: input.ticketId,
      changed_by: input.assignedBy,
      from_status: ticket.current_status,
      to_status: input.nextStatus,
      note: `Penugasan teknisi: ${technician.name}`,
    });
  }

  return {
    ticket: updated,
    fromTechnician: fromTechnician ?? null,
    toTechnician: technician,
    note,
  };
}

export async function getTechnicianWorkload(executor: Knex, tenantId: string, branchId: string) {
  return listTechnicianWorkload(executor, tenantId, branchId);
}
