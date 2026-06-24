<?php

namespace App\Http\Controllers;

use App\Models\ServiceTicket; // Hubungkan dengan model tiket nanti
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    /**
     * Tampilkan halaman utama cek resi (Halaman depan publik)
     */
    public function index()
    {
        return view('tracking.index');
    }

    /**
     * Proses pencarian nomor tiket servis ala resi J&T
     */
    public function search(Request $request)
    {
        $request->validate([
            'kode_servis' => 'required|string',
        ], [
            'kode_servis.required' => 'Nomor tiket/resi tidak boleh kosong!'
        ]);

        $kodeServis = $request->input('kode_servis');

        // Cari tiket di database SEKALIGUS muat relasi sub-task ('tasks') dan teknisi ('user')
        $ticket = ServiceTicket::with(['tasks', 'user'])->where('kode_servis', $kodeServis)->first();

        if (!$ticket) {
            return redirect()->route('tracking.index')
                ->with('error', 'Nomor tiket atau resi tidak ditemukan. Silakan periksa kembali!');
        }

        return view('tracking.result', compact('ticket'));
    }
}
