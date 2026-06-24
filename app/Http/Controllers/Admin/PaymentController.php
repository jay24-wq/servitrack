<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\ServiceTicket;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function index()
    {
        // Hitung pendapatan hari ini dari pembayaran yang sudah lunas
        $pendapatanHariIni = Payment::whereDate('tanggal_bayar', today())
            ->where('status', 'lunas')
            ->sum('total');

        // Tentukan target pendapatan harian (misalnya Rp500.000)
        $targetPendapatan = 500000;

        // Buat array statistik
        $stats = [
            'pendapatan_hari_ini' => $pendapatanHariIni,
            'target_pendapatan'   => $targetPendapatan,
            'total'               => Payment::count(),
        ];

        return view('admin.payment', compact('stats'));
    }

    public function search(Request $request)
    {
        $ticket = null;
        $error  = null;

        if ($request->filled('kode')) {
            $ticket = ServiceTicket::with('user', 'tasks', 'payment')
                ->where('kode_servis', strtoupper(trim($request->kode)))
                ->first();

            if (!$ticket) {
                $error = 'Tiket dengan kode "' . $request->kode . '" tidak ditemukan.';
            }
        }

        return view('admin.payment', compact('ticket', 'error'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'service_ticket_id' => 'required|exists:service_tickets,id',
            'biaya_sparepart'   => 'required|integer|min:0',
            'biaya_jasa'        => 'required|integer|min:0',
            'metode'            => 'required|in:tunai,qris,transfer',
            'bank'              => 'required_if:metode,transfer|in:BCA,Mandiri,BNI,BRI',
            'catatan'           => 'nullable|string',
        ]);

        $total = $request->biaya_sparepart + $request->biaya_jasa;

        Payment::updateOrCreate(
            ['service_ticket_id' => $request->service_ticket_id],
            [
                'biaya_sparepart' => $request->biaya_sparepart,
                'biaya_jasa'      => $request->biaya_jasa,
                'total'           => $total,
                'metode'          => $request->metode,
                'bank'            => $request->bank,
                'status'          => 'lunas',
                'tanggal_bayar'   => now(),
                'catatan'         => $request->catatan,
            ]
        );

        // Update total biaya dan status tiket
        $ticket = ServiceTicket::find($request->service_ticket_id);
        $ticket->update([
            'total_biaya' => $total,
            'status'      => 'selesai',
        ]);

        return redirect()->route('admin.payment')
            ->with('success', 'Pembayaran tiket ' . $ticket->kode_servis . ' berhasil diproses!');
    }
}