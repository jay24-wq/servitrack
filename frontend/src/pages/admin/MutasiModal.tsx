import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowCounterClockwise, X } from '@phosphor-icons/react';
import { getInventoryMovements, reversePartMovement } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/button';

export default function MutasiModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reverseTarget, setReverseTarget] = useState<{ id: string; reason: string } | null>(null);
  const role = (useAuthStore((state) => state.user?.role) ?? '').toLowerCase();
  const queryClient = useQueryClient();
  
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements', search, page],
    queryFn: () => getInventoryMovements(search, page, 10),
  });
  
  const pagination = data?.pagination ?? { totalPages: 1, total: 0 };
  const reversalMutation = useMutation({
    mutationFn: () => {
      if (!reverseTarget) throw new Error('Pilih movement yang akan dikoreksi');
      return reversePartMovement(reverseTarget.id, reverseTarget.reason.trim());
    },
    onSuccess: async () => {
      setReverseTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-parts'] }),
      ]);
    },
    retry: false,
  });

  return (
    <div className="w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl outline outline-1 -outline-offset-1 outline-black/10">
      <div className="flex items-start justify-between border-b border-black/10 bg-stone-50 p-6">
        <div>
          <h2 className="text-lg font-bold leading-7 text-zinc-900">
            Riwayat Mutasi Stok
          </h2>
          <p className="text-xs leading-4 text-neutral-500">
            Audit seluruh perubahan stok berdasarkan data database.
          </p>
        </div>
        <button 
          type="button" 
          onClick={onClose} 
          aria-label="Tutup" 
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-black/5"
        >
          <X size={16} />
        </button>
      </div>
      
      <div className="flex flex-col gap-4 p-6">
        <input 
          value={search} 
          onChange={(e) => { 
            setSearch(e.target.value); 
            setPage(1); 
          }} 
          placeholder="Cari SKU, nama part, atau ticket code..." 
          className="w-full rounded-lg bg-stone-100 px-3 py-2 text-xs outline outline-1 -outline-offset-1 outline-black/10 focus:bg-white focus:outline-2 focus:outline-sky-600" 
        />
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 text-stone-600">
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Part</th>
                <th className="px-3 py-3">Jenis Mutasi</th>
                <th className="px-3 py-3">Qty</th>
                <th className="px-3 py-3">Ticket</th>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">Catatan</th>
                {role === 'admin' && <th className="px-3 py-3">Koreksi</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={role === 'admin' ? 8 : 7} className="p-8 text-center text-neutral-500">
                    Memuat...
                  </td>
                </tr>
              ) : data?.data?.length ? (
                data.data.map((row: any) => (
                  <tr key={row.id} className="border-b border-black/5">
                    <td className="px-3 py-3 text-neutral-500">
                      {new Date(row.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-stone-600">{row.part_sku}</div>
                      <div className="font-semibold text-zinc-900">{row.part_name}</div>
                    </td>
                    <td className="px-3 py-3 font-semibold uppercase text-sky-700">
                      {row.movement_type}
                    </td>
                    <td className="px-3 py-3 font-bold">
                      {row.qty}
                    </td>
                    <td className="px-3 py-3">
                      {row.ticket_code || '-'}
                    </td>
                    <td className="px-3 py-3">
                      {row.user_name || '-'}
                    </td>
                    <td className="px-3 py-3 text-neutral-500">
                      {row.note || '-'}
                    </td>
                    {role === 'admin' && (
                      <td className="px-3 py-3">
                        {row.movement_type === 'out' && !row.reversal_id ? (
                          reverseTarget?.id === row.id ? (
                            <div className="flex min-w-44 flex-col gap-1.5">
                              <input
                                value={reverseTarget?.reason ?? ''}
                                onChange={(event) => setReverseTarget((current) => current ? { ...current, reason: event.target.value.slice(0, 1000) } : current)}
                                maxLength={1000}
                                placeholder="Alasan koreksi wajib"
                                className="h-8 rounded border border-stone-300 px-2 text-[11px]"
                              />
                              {reversalMutation.isError && <span role="alert" className="text-[10px] text-rose-700">Gagal mengoreksi movement.</span>}
                              <Button size="sm" disabled={!reverseTarget?.reason.trim() || reversalMutation.isPending} onClick={() => reversalMutation.mutate()} className="h-7 text-[10px]">
                                {reversalMutation.isPending ? 'Memproses…' : 'Catat reversal'}
                              </Button>
                            </div>
                          ) : <Button variant="outline" size="sm" onClick={() => setReverseTarget({ id: row.id, reason: '' })} className="h-8 gap-1 text-[10px]"><ArrowCounterClockwise className="size-3" /> Koreksi</Button>
                        ) : row.reversal_of_movement_id ? <span className="text-[10px] font-semibold text-amber-800">Reversal</span> : row.reversal_id ? <span className="text-[10px] text-stone-500">Sudah dikoreksi</span> : '—'}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={role === 'admin' ? 8 : 7} className="p-8 text-center text-neutral-500">
                    Tidak ada riwayat mutasi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-xs text-neutral-500">
            {pagination.total} mutasi
          </span>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              disabled={page <= 1} 
              onClick={() => setPage(page - 1)} 
              className="rounded-lg px-3 py-1.5 text-xs outline outline-1 -outline-offset-1 outline-black/10 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-xs text-stone-600">
              {page} / {pagination.totalPages}
            </span>
            <button 
              type="button" 
              disabled={page >= pagination.totalPages} 
              onClick={() => setPage(page + 1)} 
              className="rounded-lg px-3 py-1.5 text-xs outline outline-1 -outline-offset-1 outline-black/10 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
