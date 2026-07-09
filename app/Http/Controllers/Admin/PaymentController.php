<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\ServiceTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class PaymentController extends Controller
{
    public function index()
    {
        return view('admin.payment', [
            'ticket' => null,
        ]);
    }

    public function search(Request $request)
    {
        $kode   = trim($request->kode);
        $ticket = null;
        $error  = null;

        if ($kode) {
            // 🔒 KEAMANAN: Validasi parameter dengan whitelist regex (Alphanumeric + Hyphen)
            if (!preg_match('/^[A-Za-z0-9\-]+$/', $kode)) {
                $error = 'Format kode servis tidak valid (hanya boleh huruf, angka, dan tanda hubung).';
                return view('admin.payment', compact('ticket', 'error'));
            }

            $ticket = ServiceTicket::with([
                'user',
                'payment',
                'sparepartUsages.sparepart',
            ])->where('kode_servis', $kode)->first();

            if (!$ticket) {
                // 🔒 KEAMANAN: Escaping untuk mencegah Reflected XSS
                $error = 'Tiket dengan kode "' . htmlspecialchars($kode, ENT_QUOTES, 'UTF-8') . '" tidak ditemukan.';
            } elseif (!in_array($ticket->status, ['siap diambil', 'selesai'])) {
                $error = "Tiket ini belum selesai dikerjakan (status: {$ticket->status}). Pembayaran hanya bisa diproses untuk tiket berstatus Siap Diambil.";
                $ticket = null;
            }
        }

        $biayaSparepart = $ticket
            ? $ticket->sparepartUsages->sum('total_harga')
            : 0;

        return view('admin.payment', compact('ticket', 'error', 'biayaSparepart'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'service_ticket_id' => 'required|exists:service_tickets,id',
            'biaya_sparepart'   => 'required|integer|min:0',
            'metode'            => 'required|in:tunai,qris,transfer',
            'bank'              => 'required_if:metode,transfer|in:BCA,Mandiri,BNI,BRI',
            'catatan'           => 'nullable|string',
        ]);

        $ticket = ServiceTicket::with('sparepartUsages')->findOrFail($request->service_ticket_id);

        if ($ticket->payment && $ticket->payment->status === 'lunas') {
            return back()->with('error', 'Tiket ini sudah dibayar sebelumnya.');
        }

        $biayaSparepart = $ticket->sparepartUsages->sum('total_harga');
        $biayaJasa      = 50000;
        $total          = $biayaSparepart + $biayaJasa;

        Payment::updateOrCreate(
            ['service_ticket_id' => $ticket->id],
            [
                'biaya_sparepart' => $biayaSparepart,
                'biaya_jasa'      => $biayaJasa,
                'metode'          => $request->metode,
                'bank'            => $request->metode === 'transfer' ? strtoupper($request->bank_name) : null,
                'status'          => 'lunas',
                'tanggal_bayar'   => Carbon::now(),
                'catatan'         => $request->catatan,
            ]
        );

        $ticket->update([
            'status'     => 'selesai',
            'sub_status' => null,
        ]);

        return redirect()
            ->route('admin.payment.nota', $ticket->id)
            ->with('success', 'Pembayaran berhasil diproses!');
    }

    public function nota(ServiceTicket $ticket)
    {
        $ticket->load(['user', 'payment', 'sparepartUsages.sparepart']);

        if (!$ticket->payment) {
            return redirect()->route('admin.payment.index')
                ->with('error', 'Pembayaran untuk tiket ini belum ditemukan.');
        }

        return view('admin.payment-nota', compact('ticket'));
    }
}