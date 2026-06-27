<?php

namespace App\Http\Controllers\Teknisi;

use App\Http\Controllers\Controller;
use App\Models\ServiceTicket;
use Illuminate\Http\Request;

class TaskController extends Controller
{
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
                ->where('user_id', auth()->id())
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

    public function updateStatus(Request $request, ServiceTicket $ticket)
    {
        if ($ticket->user_id !== auth()->id()) {
            abort(403);
        }

        $request->validate([
            'status' => 'required|in:antrian,pengecekan,menunggu part,pengerjaan,quality control,siap diambil,selesai',
        ]);

        $ticket->update(['status' => $request->status]);

        return back()->with('success', 'Status tiket diperbarui!');
    }

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
}