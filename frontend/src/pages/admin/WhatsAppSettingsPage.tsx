import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowClockwise, CheckCircle, PaperPlaneTilt, WarningCircle, WhatsappLogo } from '@phosphor-icons/react';
import { Button } from '../../components/ui/button';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppConnectionStatus,
  sendWhatsAppConnectionTest,
  type WhatsAppConnectionStatus,
} from '../../lib/api';
import { useAuthStore } from '../../store';

const QUERY_KEY = 'whatsapp-connection';
const QR_STATES = new Set(['created', 'initializing', 'qr_ready', 'authenticating']);

function phoneLabel(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return `+62 ${digits.slice(2)}`;
  return phone;
}

function disconnectedDetail(status?: WhatsAppConnectionStatus, requestFailed = false) {
  if (requestFailed || !status?.openwa_reachable || status?.session_status === 'openwa_unreachable') return 'OpenWA tidak terjangkau. Periksa koneksi lalu coba lagi.';
  switch (status?.session_status) {
    case null:
    case undefined:
      return 'Belum pernah dihubungkan. Hubungkan nomor WhatsApp bengkel untuk mulai mengirim notifikasi.';
    case 'qr_ready':
      return 'Pindai QR dengan WhatsApp bengkel melalui Perangkat tertaut.';
    case 'created':
    case 'initializing':
    case 'authenticating':
      return 'Menyiapkan sesi WhatsApp. QR akan tampil setelah siap dipindai.';
    case 'number_mismatch':
      return 'Nomor WhatsApp yang terhubung berbeda dari nomor telepon bengkel. Pengiriman dinonaktifkan.';
    case 'number_unavailable':
      return 'OpenWA belum memberikan nomor pengirim. Koneksi belum dapat diverifikasi.';
    case 'disconnected':
    case 'failed':
      return 'Sesi terputus. Hubungkan ulang untuk melanjutkan pengiriman.';
    default:
      return 'WhatsApp belum siap mengirim pesan.';
  }
}

export default function WhatsAppSettingsPage() {
  const tenantId = useAuthStore((state) => state.user?.tenant_id);
  const queryClient = useQueryClient();
  const queryKey = [QUERY_KEY, tenantId];
  const [recipient, setRecipient] = useState('');
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const statusQuery = useQuery({
    queryKey,
    queryFn: getWhatsAppConnectionStatus,
    enabled: Boolean(tenantId),
    refetchInterval: (query) => {
      const status = query.state.data;
      return status && !status.connected && QR_STATES.has(status.session_status ?? '') ? 3000 : false;
    },
  });
  const status = statusQuery.data;

  useEffect(() => {
    if (!recipient && status?.test_recipient_default) setRecipient(status.test_recipient_default);
  }, [recipient, status?.test_recipient_default]);

  useEffect(() => () => {
    queryClient.removeQueries({ queryKey });
  }, [queryClient, tenantId]);

  const connectMutation = useMutation({
    mutationFn: connectWhatsApp,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setActionError('');
      setDisconnectConfirm(false);
    },
    onError: (error: any) => setActionError(error?.response?.data?.error || 'Gagal menghubungkan WhatsApp. Coba lagi.'),
  });
  const disconnectMutation = useMutation({
    mutationFn: disconnectWhatsApp,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      setActionError('');
      setDisconnectConfirm(false);
      setTestResult(null);
    },
    onError: (error: any) => setActionError(error?.response?.data?.error || 'Gagal memutuskan koneksi WhatsApp. Coba lagi.'),
  });
  const testMutation = useMutation({
    mutationFn: sendWhatsAppConnectionTest,
    onSuccess: (result) => setTestResult({
      ok: true,
      message: result.provider_message_id ? `Pesan terkirim · ID ${result.provider_message_id}` : 'Pesan terkirim.',
    }),
    onError: (error: any) => setTestResult({
      ok: false,
      message: error?.response?.data?.error || 'Pesan percobaan gagal dikirim.',
    }),
  });

  const connected = status?.connected === true && !statusQuery.isError;
  const waitingForQr = Boolean(status?.qr_code) && !statusQuery.isError;
  const loading = statusQuery.isPending;
  const requestFailed = statusQuery.isError;
  const canReconnect = !connected && (requestFailed || !status?.session_status || ['disconnected', 'failed', 'openwa_unreachable'].includes(status.session_status));
  const needsNewQr = !connected && ['number_mismatch', 'number_unavailable'].includes(status?.session_status ?? '');
  const statusTitle = loading ? 'Memeriksa koneksi' : connected ? 'Connected' : 'Disconnected';

  return (
    <div className="page-enter flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-zinc-900">WhatsApp</h1>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">
          Hubungkan nomor bengkel untuk mengirim quotation dan notifikasi kepada pelanggan.
        </p>
      </header>

      <section aria-labelledby="whatsapp-status-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
              <WhatsappLogo weight="fill" className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="whatsapp-status-heading" className="text-base font-semibold leading-6 text-zinc-900">Koneksi WhatsApp bengkel</h2>
                <span className={`inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold ${connected ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>
                  {connected && <CheckCircle weight="fill" className="size-3.5" />}
                  {statusTitle}
                </span>
              </div>
              <p aria-live="polite" className="mt-1 max-w-2xl text-xs leading-5 text-stone-600">
                {disconnectedDetail(status, requestFailed)}
              </p>
            </div>
          </div>

          {connected || needsNewQr ? (
            <Button type="button" variant="outline" disabled={disconnectMutation.isPending} onClick={() => { setDisconnectConfirm(true); setActionError(''); }}>
              {disconnectMutation.isPending ? 'Memutuskan…' : 'Putuskan koneksi'}
            </Button>
          ) : canReconnect ? (
            <Button type="button" disabled={connectMutation.isPending || loading} onClick={() => { setActionError(''); void connectMutation.mutateAsync().catch(() => undefined); }}>
              <ArrowClockwise weight="bold" className="size-4" />
              {connectMutation.isPending || loading ? 'Menghubungkan…' : requestFailed || status?.session_status === 'openwa_unreachable' ? 'Coba lagi' : status?.session_status ? 'Hubungkan ulang' : 'Hubungkan WhatsApp'}
            </Button>
          ) : null}
        </div>

        {waitingForQr && (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-center sm:flex-row sm:items-center sm:text-left">
            <img src={status?.qr_code ?? ''} alt="QR code untuk menghubungkan WhatsApp bengkel" className="size-52 rounded-md border border-stone-200 bg-white p-2" />
            <div className="max-w-md">
              <h3 className="text-sm font-semibold text-zinc-900">Pindai QR dengan WhatsApp</h3>
              <p className="mt-1 text-xs leading-5 text-stone-600">Buka WhatsApp di ponsel bengkel, pilih Perangkat tertaut, lalu pindai QR ini. QR diperbarui otomatis sampai koneksi terverifikasi.</p>
            </div>
          </div>
        )}

        <div className="mt-5 grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Nomor pengirim dari OpenWA</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
              {requestFailed ? 'Nomor tidak tersedia' : status?.connected_phone ?? 'Nomor tidak tersedia'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Nomor telepon bengkel</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">{status?.tenant_phone ? phoneLabel(status.tenant_phone) : 'Nomor belum diatur'}</p>
          </div>
        </div>

        {!requestFailed && status?.phone_matches === false && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
            <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />
            Nomor WhatsApp berbeda dengan nomor telepon bengkel. Pengiriman pesan dinonaktifkan sampai nomor yang sesuai dihubungkan.
          </p>
        )}

        {status?.last_verified_at && (
          <p className="mt-3 text-[11px] leading-4 text-stone-500">
            Terakhir diverifikasi {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(status.last_verified_at))}
          </p>
        )}

        {disconnectConfirm && (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-900">Putuskan WhatsApp bengkel?</p>
            <p className="mt-1 text-xs leading-5 text-rose-800">Quotation dan notifikasi tidak akan terkirim sampai WhatsApp dihubungkan lagi.</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={disconnectMutation.isPending} onClick={() => setDisconnectConfirm(false)}>Batal</Button>
              <Button type="button" variant="destructive" disabled={disconnectMutation.isPending} onClick={() => void disconnectMutation.mutateAsync().catch(() => undefined)}>
                {disconnectMutation.isPending ? 'Memutuskan…' : 'Ya, putuskan koneksi'}
              </Button>
            </div>
          </div>
        )}

        {(actionError || requestFailed) && (
          <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-800">
            {actionError || disconnectedDetail(status, true)}
            {requestFailed && <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={() => void statusQuery.refetch()}>Coba lagi</button>}
          </p>
        )}
      </section>

      <section aria-labelledby="whatsapp-test-heading" className="rounded-xl border border-black/10 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <PaperPlaneTilt weight="fill" className="size-4.5" />
          </span>
          <div>
            <h2 id="whatsapp-test-heading" className="text-sm font-semibold leading-5 text-zinc-900">Kirim pesan percobaan</h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">Pesan uji dikirim ke nomor admin yang login, atau nomor lain yang Anda masukkan. Pesan ini tidak dikirim ke pelanggan.</p>
          </div>
        </div>

        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => {
          event.preventDefault();
          setTestResult(null);
          testMutation.mutate(recipient);
        }}>
          <label className="min-w-0 flex-1 text-xs font-medium text-stone-700">
            Nomor tujuan test
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="Contoh: 0812 3456 7890"
              className="mt-1.5 min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <Button type="submit" disabled={!connected || !recipient.trim() || testMutation.isPending}>
            <PaperPlaneTilt weight="fill" className="size-4" />
            {testMutation.isPending ? 'Mengirim…' : 'Kirim pesan percobaan'}
          </Button>
        </form>

        {!connected && <p className="mt-2 text-[11px] leading-4 text-stone-500">Hubungkan WhatsApp dengan nomor yang sesuai sebelum mengirim test.</p>}
        {connected && !recipient.trim() && <p className="mt-2 text-[11px] leading-4 text-stone-500">Isi nomor tujuan untuk mengaktifkan tombol test.</p>}
        {testResult && (
          <p role={testResult.ok ? 'status' : 'alert'} className={`mt-4 flex items-start gap-2 rounded-lg px-3.5 py-3 text-xs leading-5 ${testResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            {testResult.ok ? <CheckCircle weight="fill" className="mt-0.5 size-4 shrink-0" /> : <WarningCircle weight="fill" className="mt-0.5 size-4 shrink-0" />}
            {testResult.message}
          </p>
        )}
        <p className="mt-4 border-t border-stone-100 pt-3 text-[11px] leading-4 text-stone-500">Maksimal 5 pesan percobaan dalam 10 menit untuk tenant ini.</p>
      </section>
    </div>
  );
}
