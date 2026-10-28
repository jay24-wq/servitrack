import type { Knex } from 'knex';

export const ACTIVE_TICKET_STATUSES = [
  'antrian',
  'pengecekan',
  'menunggu_part',
  'pengerjaan',
  'quality_check',
] as const;

export type AssignmentType = 'AUTO' | 'MANUAL';

export interface TechnicianWorkload {
  id: string;
  name: string;
  created_at: string | Date;
  active_count: number;
  total_count: number;
  completed_count: number;
  last_assigned_at: string | Date | null;
}

export interface AssignmentLogInput {
  tenant_id: string;
  ticket_id: string;
  from_technician_id?: string | null;
  to_technician_id?: string | null;
  assignment_type: AssignmentType;
  assigned_by?: string | null;
  note: string;
  meta?: Record<string, unknown>;
}

type DbExecutor = Knex | Knex.Transaction;

const WORKLOAD_SELECT = `
  SELECT
    u.id,
    u.name,
    u.created_at,
    COALESCE(load.active_count, 0)::int AS active_count,
    COALESCE(load.total_count, 0)::int AS total_count,
    COALESCE(load.completed_count, 0)::int AS completed_count,
    load.last_assigned_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE t.current_status = ANY(?::text[]))::int AS active_count,
      count(*)::int AS total_count,
      count(*) FILTER (WHERE t.current_status IN ('selesai', 'siap_diambil'))::int AS completed_count,
      max(t.assigned_at) AS last_assigned_at
    FROM service_tickets t
    WHERE t.tenant_id = u.tenant_id
      AND t.technician_id = u.id
  ) load ON true
  WHERE u.tenant_id = ?
    AND r.code = 'teknisi'
    AND u.is_active = true
    AND u.deleted_at IS NULL
`;

const WORKLOAD_ORDER = `
  ORDER BY
    active_count ASC,
    load.last_assigned_at ASC NULLS FIRST,
    u.created_at ASC,
    u.id ASC
`;

function workloadBindings(tenantId: string, technicianId?: string): any[] {
  const bindings: any[] = [ACTIVE_TICKET_STATUSES, tenantId];
  if (technicianId) bindings.push(technicianId);
  return bindings;
}

export async function listTechnicianWorkload(
  executor: DbExecutor,
  tenantId: string
): Promise<TechnicianWorkload[]> {
  const result = (await executor.raw(`${WORKLOAD_SELECT} ${WORKLOAD_ORDER}`, workloadBindings(tenantId))) as {
    rows: TechnicianWorkload[];
  };
  return result.rows;
}

export async function findLeastLoadedTechnician(
  executor: DbExecutor,
  tenantId: string
): Promise<TechnicianWorkload | null> {
  const result = (await executor.raw(
    `${WORKLOAD_SELECT} ${WORKLOAD_ORDER} LIMIT 1`,
    workloadBindings(tenantId)
  )) as { rows: TechnicianWorkload[] };
  return result.rows[0] ?? null;
}

export async function findActiveTechnician(
  executor: DbExecutor,
  tenantId: string,
  technicianId: string
): Promise<TechnicianWorkload | null> {
  const result = (await executor.raw(
    `${WORKLOAD_SELECT} AND u.id = ? ${WORKLOAD_ORDER} LIMIT 1`,
    workloadBindings(tenantId, technicianId)
  )) as { rows: TechnicianWorkload[] };
  return result.rows[0] ?? null;
}

export async function createAssignmentLog(executor: DbExecutor, input: AssignmentLogInput) {
  const [row] = await executor('ticket_assignment_logs')
    .insert({
      tenant_id: input.tenant_id,
      ticket_id: input.ticket_id,
      from_technician_id: input.from_technician_id ?? null,
      to_technician_id: input.to_technician_id ?? null,
      assignment_type: input.assignment_type,
      assigned_by: input.assigned_by ?? null,
      note: input.note,
      meta: input.meta ?? {},
    })
    .returning('*');
  return row;
}
