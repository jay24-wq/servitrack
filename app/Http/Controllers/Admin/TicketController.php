<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceTicket;
use App\Models\User;
use Illuminate\Http\Request;
use App\Models\Sparepart;
use App\Models\Payment;
use Carbon\Carbon;

class TicketController extends Controller
{
    
    public function index()
    {
        $pendapatanHariIni = Payment::whereDate('tanggal_bayar', today())
            ->where('status', 'lunas')
            ->sum('total');

        $targetPendapatan = 500000;

        $stats = [
            'pendapatan_hari_ini' => $pendapatanHariIni,
            'target_pendapatan'   => $targetPendapatan,
            'total'               => Payment::count(),
        ];

        return view('admin.dashboard', compact('stats'));
    }
    

    public function create()
    {
        $teknisi  = User::where('role', 'teknisi')->get();
        $no_resi  = 'Auto-generate saat disimpan';
        return view('admin.tickets.index', compact('teknisi', 'no_resi'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'customer_name'    => 'required|string|max:100',
            'phone_number'     => 'required|string|max:15',
            'email'            => 'nullable|email|max:100',
            'checkin_date'     => 'required|date',
            'device_name'      => 'required|string|max:100',
            'device_brand'     => 'nullable|string|max:50',
            'device_serial'    => 'required|string|max:50',
            'device_condition' => 'nullable|string|max:255',
            'keluhan'          => 'nullable|string',
            'user_id'          => 'nullable|exists:users,id',
        ]);

        $kode = 'SRV-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -4));

        ServiceTicket::create([
            'kode_servis'      => $kode,
            'nama_pelanggan'   => $request->customer_name,
            'nomor_hp'         => $request->phone_number,
            'email'            => $request->email,
            'checkin_date'     => $request->checkin_date,
            'device_name'      => $request->device_name,
            'device_brand'     => $request->device_brand,
            'device_serial'    => $request->device_serial,
            'device_condition' => $request->device_condition,
            'keluhan'          => $request->keluhan,
            'user_id'          => $request->user_id,
            'status'           => 'antrian',
        ]);

        return redirect()->route('admin.dashboard')
            ->with('success', 'Tiket ' . $kode . ' berhasil dibuat!');
    }

    public function show(ServiceTicket $ticket)
    {
        $ticket->load('user', 'tasks');
        return view('admin.tickets.show', compact('ticket'));
    }

    public function updateStatus(Request $request, ServiceTicket $ticket)
    {
        $request->validate([
            'status' => 'required|in:antrian,pengecekan,menunggu part,pengerjaan,quality control,siap diambil,selesai',
        ]);

        $ticket->update(['status' => $request->status]);

        return back()->with('success', 'Status tiket diperbarui!');
    }

    public function overview()
    {
        // Stats cards
        $stats = [
            'total'            => ServiceTicket::count(),
            'antrian'          => ServiceTicket::where('status', 'antrian')->count(),
            'selesai_hari_ini' => ServiceTicket::where('status', 'selesai')
                                    ->whereDate('updated_at', today())->count(),
            'selesai_growth'   => 12, // nanti bisa dihitung dinamis
            'pendapatan_hari_ini' => Payment::whereDate('tanggal_bayar', today())
                                ->where('status', 'lunas')
                                ->sum('total'),
            'target_pendapatan'   => 500000,
        ];

        // Chart data 7 hari terakhir
        $maxCount = 1;
        $rawChart = [];
        for ($i = 6; $i >= 0; $i--) {
            $date  = Carbon::now()->subDays($i);
            $count = ServiceTicket::whereDate('created_at', $date)->count();
            $rawChart[] = [
                'label'    => $date->translatedFormat('D'),
                'count'    => $count,
                'is_today' => $i === 0,
            ];
            if ($count > $maxCount) $maxCount = $count;
        }
        $chartData = array_map(function ($day) use ($maxCount) {
            $day['height'] = $maxCount > 0 ? max(5, round(($day['count'] / $maxCount) * 100)) : 5;
            return $day;
        }, $rawChart);

        // Tiket terbaru
        $recentTickets = ServiceTicket::latest()->take(3)->get();

        // Stok kritis
        $stokKritis = Sparepart::whereColumn('sparepart_stock', '<=', 'stok_minimum')->count();

        // Teknisi
        $teknisiAktif  = \App\Models\User::where('role', 'teknisi')->get();
        $teknisiOnDuty = $teknisiAktif->count() > 0 ? min(2, $teknisiAktif->count()) : 0;

        return view('admin.dashboard', compact(
            'stats', 'chartData', 'recentTickets', 'stokKritis', 'teknisiAktif', 'teknisiOnDuty'
        ));
        
    }

    public function queue(Request $request)
    {
        $query = ServiceTicket::with('user')->latest();

        if ($request->status) {
        $query->where('status', $request->status);
        }

        if ($request->teknisi) {
        $query->where('user_id', $request->teknisi);
        }

        $tickets = $query->paginate(10)->withQueryString();

        $todayPengerjaan = ServiceTicket::where('status', 'pengerjaan')
            ->whereDate('updated_at', today())
            ->count();

        $yesterdayPengerjaan = ServiceTicket::where('status', 'pengerjaan')
            ->whereDate('updated_at', today()->subDay())
            ->count();

        $growthPengerjaan = $todayPengerjaan - $yesterdayPengerjaan;

        $totalTickets     = ServiceTicket::count();
        $completedTickets = ServiceTicket::where('status', 'selesai')->count();
        $efficiencyRate   = $totalTickets > 0
            ? round(($completedTickets / $totalTickets) * 100)
            : 0;

        $stats = [
            'pengerjaan'        => $todayPengerjaan,
            'pengerjaan_growth' => $growthPengerjaan,
            'antrian'           => ServiceTicket::where('status', 'antrian')->count(),
            'selesai_hari_ini'  => ServiceTicket::where('status', 'selesai')
                                ->whereDate('updated_at', today())->count(),
            'urgent'            => ServiceTicket::where('status', 'antrian')
                                ->whereNull('user_id')->count(),
            'efficiency_rate'   => $efficiencyRate,
        ];

        $teknisiList = \App\Models\User::where('role', 'teknisi')->get();

        return view('admin.queue', compact('tickets', 'stats', 'teknisiList'));
    }

    public function reports()
    {
        // Stats utama
        $totalPendapatan = \App\Models\Payment::where('status', 'lunas')->sum('total');
        $totalBiayaPart  = \App\Models\Payment::where('status', 'lunas')->sum('biaya_sparepart');
        $keuntunganBersih = $totalPendapatan - $totalBiayaPart;

        $perangkatSelesai = ServiceTicket::where('status', 'selesai')->count();
        $totalTicket      = ServiceTicket::count();

        // Rata-rata waktu servis (hari dari created_at ke updated_at saat selesai)
        $avgWaktu = ServiceTicket::where('status', 'selesai')
            ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_hari')
            ->value('avg_hari');

        // Chart 6 bulan terakhir
        $chartData = [];
        $maxVal    = 1;
        for ($i = 5; $i >= 0; $i--) {
            $date  = now()->subMonths($i);
            $total = \App\Models\Payment::where('status', 'lunas')
                ->whereYear('created_at', $date->year)
                ->whereMonth('created_at', $date->month)
                ->sum('total');
            $chartData[] = [
                'label' => strtoupper($date->translatedFormat('M')),
                'value' => $total,
            ];
            if ($total > $maxVal) $maxVal = $total;
        }
        foreach ($chartData as &$d) {
            $d['height'] = max(5, round(($d['value'] / $maxVal) * 100));
        }

        // Teknisi performa
        $teknisiPerforma = \App\Models\User::where('role', 'teknisi')
            ->withCount(['tickets as tiket_selesai' => function ($q) {
                $q->where('status', 'selesai');
            }])
            ->having('tiket_selesai', '>', 0)
            ->orderByDesc('tiket_selesai')
            ->get()
            ->map(function ($tek) {
                $avgHari = ServiceTicket::where('user_id', $tek->id)
                    ->where('status', 'selesai')
                    ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_hari')
                    ->value('avg_hari') ?? 0;

                $skor = max(0, min(100, 100 - ($avgHari * 5)));

                return [
                    'nama'          => $tek->name,
                    'tiket_selesai' => $tek->tiket_selesai,
                    'avg_hari'      => round($avgHari, 1),
                    'skor'          => round($skor),
                    'trend'         => $skor >= 90 ? 'up' : ($skor >= 75 ? 'flat' : 'down'),
                ];
            });

        return view('admin.reports', compact(
            'totalPendapatan', 'keuntunganBersih',
            'perangkatSelesai', 'totalTicket',
            'avgWaktu', 'chartData', 'teknisiPerforma'
        ));
    }
}