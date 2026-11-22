import type { AuthRequest } from '@middleware/AuthMiddleware';
import type { Knex } from 'knex';

type DbExecutor = Knex | Knex.Transaction;

interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ticketId?: string | null;
  quotationId?: string | null;
  notificationId?: string | null;
  actorType?: 'user' | 'customer' | 'system';
  note?: string | null;
}

export async function logAudit(db: DbExecutor, req: AuthRequest, event: AuditEvent) {
  const { tenant_id, user_id } = req.user ?? {};
  if (!tenant_id) throw new Error('Tenant tidak teridentifikasi untuk audit log');

  await db('audit_logs').insert({
    tenant_id,
    user_id: user_id || null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    ticket_id: event.ticketId ?? (event.entityType === 'service_ticket' ? event.entityId : null),
    quotation_id: event.quotationId ?? (event.entityType === 'quotation' ? event.entityId : null),
    notification_id: event.notificationId ?? null,
    actor_type: event.actorType ?? (user_id ? 'user' : 'system'),
    old_values: event.oldValues ?? null,
    new_values: event.newValues ?? null,
    ip_address: req.ip || null,
    user_agent: req.get('user-agent') || null,
    note: event.note ?? null,
  });
}
