ALTER TABLE public.service_tickets
  ADD COLUMN work_type varchar(20),
  ADD COLUMN diagnosis_status varchar(30),
  ADD COLUMN technician_diagnosis text,
  ADD COLUMN additional_damage text,
  ADD COLUMN technician_note text,
  ADD COLUMN requested_part_id uuid REFERENCES public.parts (id) ON DELETE SET NULL,
  ADD COLUMN requested_part_qty integer,
  ADD COLUMN workflow_resolution varchar(30),
  ADD COLUMN cancelled_at timestamptz,
  DROP CONSTRAINT IF EXISTS service_tickets_current_status_check,
  ADD CONSTRAINT service_tickets_current_status_check CHECK (current_status IN (
    'antrian', 'pengecekan', 'menunggu_part', 'menunggu_persetujuan', 'pengerjaan',
    'quality_check', 'selesai', 'siap_diambil', 'batal'
  )),
  ADD CONSTRAINT service_tickets_work_type_check CHECK (work_type IS NULL OR work_type IN ('without_parts', 'with_parts')),
  ADD CONSTRAINT service_tickets_diagnosis_status_check CHECK (
    diagnosis_status IS NULL OR diagnosis_status IN ('matches_complaint', 'additional_damage')
  ),
  ADD CONSTRAINT service_tickets_requested_part_qty_check CHECK (
    requested_part_qty IS NULL OR requested_part_qty > 0
  ),
  ADD CONSTRAINT service_tickets_requested_part_pair_check CHECK (
    (requested_part_id IS NULL AND requested_part_qty IS NULL) OR
    (requested_part_id IS NOT NULL AND requested_part_qty IS NOT NULL)
  ),
  ADD CONSTRAINT service_tickets_workflow_resolution_check CHECK (
    workflow_resolution IS NULL OR workflow_resolution IN ('continue_original', 'cancel_and_return')
  );

DROP TRIGGER IF EXISTS trg_tenant_service_tickets ON public.service_tickets;
CREATE TRIGGER trg_tenant_service_tickets
  BEFORE INSERT OR UPDATE ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
    'branch_id.branches',
    'customer_id.customers',
    'device_id.devices',
    'received_by.users',
    'technician_id.users',
    'requested_part_id.parts'
  );

ALTER TABLE public.ticket_status_logs
  ALTER COLUMN changed_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS ticket_status_logs_from_status_check,
  DROP CONSTRAINT IF EXISTS ticket_status_logs_to_status_check,
  ADD CONSTRAINT ticket_status_logs_from_status_check CHECK (
    from_status IS NULL OR from_status IN (
      'antrian', 'pengecekan', 'menunggu_part', 'menunggu_persetujuan', 'pengerjaan',
      'quality_check', 'selesai', 'siap_diambil', 'batal'
    )
  ),
  ADD CONSTRAINT ticket_status_logs_to_status_check CHECK (to_status IN (
    'antrian', 'pengecekan', 'menunggu_part', 'menunggu_persetujuan', 'pengerjaan',
    'quality_check', 'selesai', 'siap_diambil', 'batal'
  ));

CREATE INDEX idx_tickets_tenant_diagnosis ON public.service_tickets (tenant_id, diagnosis_status, work_type);

CREATE OR REPLACE FUNCTION public.resolve_tenant_by_quotation_token(p_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.quotations
  WHERE approval_token = p_token
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant_by_quotation_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_quotation_token(text) TO servitrack_app;
