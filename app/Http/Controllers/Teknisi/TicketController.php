<?php

namespace App\Http\Controllers\Teknisi;

use App\Http\Controllers\Controller;
use App\Models\ServiceTicket;
use Illuminate\Http\Request;

class TicketController extends Controller
{
    /**
     * Halaman Dashboard Teknisi (Dipindahkan dari TaskController)
     */
    public function dashboard()
    {
        $myTickets = ServiceTicket::where('user_id', auth()->id())->get();

        $stats = [
            'aktif'   => $myTickets->whereNotIn('status', ['selesai'])->count(),
            'selesai' => $myTickets->where('status', 'selesai')->count(),
            'urgent'  => $myTickets->where('status', 'menunggu part')->count(),
        ];

        return view('teknisi.dashboard', compact('stats', 'myTickets'));
    }

    /**
     * Halaman Kanban Board (Dipindahkan & Disinkronkan)
     */
    public function index()
    {
        $statuses = [
            'antrian'         => ['label' => 'ANTRIAN',         'color' => 'border-gray-600',   'dot' => 'bg-gray-500'],
            'pengecekan'      => ['label' => 'PENGECEKAN',      'color' => 'border-amber-500',  'dot' => 'bg-amber-500'],
            'menunggu part'   => ['label' => 'MENUNGGU PART',   'color' => 'border-orange-500', 'dot' => 'bg-orange-500'],
            'pengerjaan'      => ['label' => 'PENGERJAAN',      'color' => 'border-blue-500',   'dot' => 'bg-blue-500'],
            'quality control' => ['label' => 'QUALITY CONTROL', 'color' => 'border-purple-500', 'dot' => 'bg-purple-500'],
            'siap diambil'    => ['label' => 'SIAP DIAMBIL',    'color' => 'border-teal-500',   'dot' => 'bg-teal-500'],
            'selesai'         => ['label' => 'SELESAI',         'color' => 'border-emerald-500','dot' => 'bg-emerald-500'],
        ];

        $columns = [];
        foreach ($statuses as $status => $config) {
            $tickets = ServiceTicket::with('user')
                ->where('user_id', auth()->id()) // Sesuaikan dengan kolom relasi user/teknisi kamu
                ->where('status', $status)
                ->latest()
                ->get();

            $columns[$status] = array_merge($config, [
                'tickets' => $tickets,
                'count'   => $tickets->count(),
            ]);
        }

        return view('teknisi.my-tasks', compact('columns'));
    }

    /**
     * Update status cepat dari tombol dropdown Kanban.
     * Menggunakan Route Model Binding {service_ticket}
     */
    public function updateStatus(Request $request, ServiceTicket $service_ticket)
    {
        // Validasi kepemilikan tiket sesuai logika lamamu
        if ($service_ticket->user_id !== auth()->id()) {
            abort(403);
        }

        $request->validate([
            'status' => 'required|in:antrian,pengecekan,menunggu part,pengerjaan,quality control,siap diambil,selesai',
        ]);

        $service_ticket->update([
            'status'     => $request->status,
            'sub_status' => null, // 💡 Otomatis reset sub_status saat kartu ditarik/dipindahkan manual via dropdown
        ]);

        return back()->with('success', 'Status tiket diperbarui!');
    }

    /**
     * Update detail dari dalam modal — menangani Kondisi A, B, C, dan D.
     */
    public function updateDetail(Request $request, ServiceTicket $service_ticket)
    {
        if ($service_ticket->user_id !== auth()->id()) {
            abort(403);
        }

        if ($service_ticket->sub_status === 'waiting_approval') {
            return back()->with('error', 'Tiket sedang menunggu persetujuan pelanggan via WA.');
        }

        $kondisi = $request->input('kondisi');

        match ($kondisi) {

            // ── BARU: Antrian → Pengecekan ──
            'ANTRIAN_TO_PENGECEKAN' => (function () use ($service_ticket) {
                $service_ticket->update([
                    'status'     => 'pengecekan',
                    'sub_status' => null,
                ]);
            })(),

            // ── KONDISI A ──
            'A' => (function () use ($request, $service_ticket) {
                $request->validate([
                    'catatan_teknisi'     => ['required', 'string', 'max:2000'],
                    'nama_part_tambahan'  => ['required', 'string', 'max:255'],
                    'harga_part_tambahan' => ['required', 'integer', 'min:0'],
                    'biaya_jasa_tambahan' => ['required', 'integer', 'min:0'],
                    'total_estimasi_baru' => ['required', 'integer', 'min:0'],
                ]);

                $service_ticket->update([
                    'status'          => 'menunggu part',
                    'sub_status'      => 'waiting_approval',
                    'catatan_teknisi' => $request->catatan_teknisi,
                    'estimasi_baru'   => $request->total_estimasi_baru,
                ]);
            })(),

            // ── KONDISI B ──
            'B' => (function () use ($request, $service_ticket) {
                if ($service_ticket->status === 'pengecekan') {
                    $request->validate([
                        'catatan_teknisi' => ['required', 'string', 'max:2000'],
                    ]);

                    $service_ticket->update([
                        'status'          => 'pengerjaan',
                        'sub_status'      => null,
                        'catatan_teknisi' => $request->catatan_teknisi,
                    ]);

                    return;
                }

                if ($service_ticket->status === 'pengerjaan') {
                    $request->validate([
                        'catatan_selesai' => ['required', 'string', 'max:2000'],
                        'id_komponen'     => ['nullable', 'array'],
                        'id_komponen.*'   => ['nullable', 'exists:spareparts,id'],
                        'jumlah_part'     => ['nullable', 'array'],
                        'jumlah_part.*'   => ['nullable', 'integer', 'min:1'],
                    ]);

                    if ($request->has('id_komponen') && is_array($request->id_komponen)) {
                        foreach ($request->id_komponen as $index => $id_komponen) {
                            if (empty($id_komponen)) continue;
                            $jumlah = $request->jumlah_part[$index] ?? 1;

                            $sparepart = \App\Models\Sparepart::findOrFail($id_komponen);
                            if ($sparepart->sparepart_stock < $jumlah) {
                                throw \Illuminate\Validation\ValidationException::withMessages([
                                    'id_komponen' => "Stok {$sparepart->nama} tidak mencukupi. Sisa: {$sparepart->sparepart_stock} unit.",
                                ]);
                            }

                            \App\Models\SparepartUsage::create([
                                'service_ticket_id' => $service_ticket->id,
                                'sparepart_id'      => $sparepart->id,
                                'jumlah_digunakan'  => $jumlah,
                                'total_harga'       => $sparepart->harga_satuan * $jumlah,
                            ]);

                            $sparepart->decrement('sparepart_stock', $jumlah);
                        }
                    }

                    // ── Update status ke quality control ──
                    $service_ticket->update([
                        'status'          => 'quality control',
                        'sub_status'      => null,
                        'catatan_teknisi' => $service_ticket->catatan_teknisi . "\n\n[SELESAI] " . $request->catatan_selesai,
                    ]);

                    return;
                }

                if ($service_ticket->status === 'quality control') {
                    $service_ticket->update([
                        'status'     => 'siap diambil',
                        'sub_status' => null,
                    ]);
                }
            })(),

            // ── KONDISI C ──
            'C' => (function () use ($request, $service_ticket) {
                $request->validate([
                    'catatan_teknisi' => ['required', 'string', 'max:2000'],
                    'nama_komponen_indent' => ['required', 'string', 'max:255'],
                ]);

                $catatanLengkap = $request->catatan_teknisi
                    . "\n\n[INDENT] Komponen yang dibutuhkan: " . $request->nama_komponen_indent;

                $service_ticket->update([
                    'status'          => 'menunggu part',
                    'sub_status'      => 'waiting_indent',
                    'catatan_teknisi' => $catatanLengkap,
                ]);
            })(),

            // ── KONDISI D ──
            'D' => (function () use ($request, $service_ticket) {
                $request->validate([
                    'catatan_teknisi' => ['required', 'string', 'max:2000'],
                    'komponen_rusak'  => ['required', 'string', 'max:255'],
                ]);

                $catatanOtomatis = "PERANGKAT TIDAK BISA DIPERBAIKI. "
                    . "Kerusakan permanen pada: {$request->komponen_rusak}. "
                    . "Catatan teknisi: {$request->catatan_teknisi}.";

                $service_ticket->update([
                    'status'          => 'siap diambil',
                    'sub_status'      => 'unrepairable',
                    'catatan_teknisi' => $catatanOtomatis,
                ]);
            })(),

            default => abort(422, 'Kondisi tidak valid.')
        };

        return back()->with('success', 'Tiket berhasil diperbarui.');
    }

    public function storeSparepartUsage(Request $request, ServiceTicket $ticket)
    {
        if ($ticket->status !== 'pengerjaan') {
            return back()->with('error', 'Sparepart hanya bisa ditambahkan saat tiket berstatus pengerjaan.');
        }

        $request->validate([
            'id_komponen'  => ['required', 'exists:spareparts,id'],
            'jumlah_part'  => ['required', 'integer', 'min:1'],
        ]);

        $sparepart = \App\Models\Sparepart::findOrFail($request->id_komponen);

        if ($sparepart->sparepart_stock < $request->jumlah_part) {
            return back()->with('error', "Stok {$sparepart->nama} tidak mencukupi. Sisa: {$sparepart->sparepart_stock} unit.");
        }

        \App\Models\SparepartUsage::create([
            'service_ticket_id' => $ticket->id,
            'sparepart_id'      => $sparepart->id,
            'jumlah_digunakan'  => $request->jumlah_part,
            'total_harga'       => $sparepart->harga_satuan * $request->jumlah_part,
        ]);

        $sparepart->decrement('sparepart_stock', $request->jumlah_part);

        return back()->with('success', "{$sparepart->nama} berhasil ditambahkan ke pemakaian tiket ini.");
    }
}