<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceTicket;
use App\Models\User;
use Illuminate\Http\Request;
use App\Http\Requests\StoreTicketRequest;
use App\Models\Sparepart;
use App\Models\Payment;
use App\Services\CloudinaryService;
use App\Models\ServiceTicketPhoto;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;

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
        $spareparts = \App\Models\Sparepart::where('sparepart_stock', '>', 0)->get();
        return view('admin.tickets.index', compact('teknisi', 'no_resi', 'spareparts'));
    }

    public function store(StoreTicketRequest $request)
    {
        // Validasi sudah ditangani oleh StoreTicketRequest (whitelist validation)

        $availableTechnician = User::where('role', 'teknisi')
            ->withCount(['tickets' => function ($query) {
                $query->whereNotIn('status', ['selesai', 'siap diambil']);
            }])
            ->orderBy('tickets_count', 'asc') // Urutkan dari yang tiket aktifnya paling sedikit (atau 0)
            ->first();

        $assignedUserId = $availableTechnician ? $availableTechnician->id : null;

        // 🔒 KEAMANAN: Kode resi yang lebih kuat dengan Str::random(8)
        $kode = 'SRV-' . date('Ymd') . '-' . strtoupper(Str::random(8));

        // 🔒 KEAMANAN: Secure File Upload ke private storage (satu foto utama)
        $photoPath = null;
        if ($request->hasFile('foto')) {
            $files = $request->file('foto');
            $file = is_array($files) ? $files[0] : $files;

            if ($file && $file->isValid()) {
                // Double-check MIME type menggunakan finfo (binary check)
                $finfo = new \finfo(FILEINFO_MIME_TYPE);
                $realMimeType = $finfo->file($file->getRealPath());

                $allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
                if (in_array($realMimeType, $allowedMimes)) {
                    // Nama file acak (UUID)
                    $safeFilename = Str::uuid() . '_' . time() . '.' . $file->getClientOriginalExtension();

                    // Simpan di disk 'local' (storage/app/private/device-photos/)
                    $photoPath = $file->storeAs('device-photos', $safeFilename, 'local');
                }
            }
        }

        $ticket = ServiceTicket::create([
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
            'user_id'          => $assignedUserId,
            'status'           => 'antrian',
            'total_biaya'      => $request->total_biaya,
            'device_photo'     => $photoPath,
        ]);

        // ── Upload foto ke Cloudinary ──
        if ($request->hasFile('foto')) {
            $cloudinary = new CloudinaryService();

            foreach ($request->file('foto') as $index => $file) {
                if (!$file->isValid()) continue;

                try {
                    $url = $cloudinary->upload(
                        $file->getRealPath(),
                        "servitrack/dokumentasi/{$kode}"
                    );

                    ServiceTicketPhoto::create([
                        'service_ticket_id' => $ticket->id,
                        'url'               => $url,
                        'keterangan'        => 'Device',
                    ]);

                } catch (\Exception $e) {
                    \Log::error("Upload foto gagal (ticket {$ticket->id}, index {$index}): " . $e->getMessage());
                    continue;
                }
            }
        }

        if (Auth::user()->role === 'frontdesk') {
            return redirect()->route('admin.tickets.create')
                ->with('success', 'Tiket ' . $kode . ' berhasil dibuat!');
        }

        return redirect()->route('admin.dashboard')
            ->with('success', 'Tiket ' . $kode . ' berhasil dibuat!');
    }

    public function show(ServiceTicket $ticket)
    {
        // 🔒 KEAMANAN: Cek otorisasi berdasarkan ServiceTicketPolicy
        Gate::authorize('view', $ticket);

        $ticket->load(['user', 'tasks', 'sparepartUsages.sparepart', 'photos']);
        return view('admin.tickets.show', compact('ticket'));
    }

    public function updateStatus(Request $request, ServiceTicket $ticket)
    {
        // 🔒 KEAMANAN: Cek otorisasi berdasarkan ServiceTicketPolicy
        Gate::authorize('updateStatus', $ticket);

        $request->validate([
            'status' => 'required|in:antrian,pengecekan,menunggu part,pengerjaan,quality control,siap diambil,selesai',
        ]);

        $ticket->update(['status' => $request->status]);

        return back()->with('success', 'Status tiket diperbarui!');
    }

    public function overview()
    {
        $selesaiHariIni = ServiceTicket::where('status', 'selesai')
                                    ->whereDate('updated_at', today())->count();
        $selesaiKemarin = ServiceTicket::where('status', 'selesai')
                                    ->whereDate('updated_at', today()->subDay())->count();
        $selesaiGrowth = 0;
        if ($selesaiKemarin > 0) {
            $selesaiGrowth = round((($selesaiHariIni - $selesaiKemarin) / $selesaiKemarin) * 100, 1);
        } elseif ($selesaiHariIni > 0) {
            $selesaiGrowth = 100.0;
        }

        // Stats cards
        $stats = [
            'total'            => ServiceTicket::count(),
            'antrian'          => ServiceTicket::where('status', 'antrian')->count(),
            'menunggu_part'    => ServiceTicket::where('status', 'menunggu part')->count(),         
            'menunggu_approval'=> ServiceTicket::where('status', 'menunggu part')                  
                                ->where('sub_status', 'waiting_approval')->count(),
            'menunggu_indent'  => ServiceTicket::where('status', 'menunggu part')                   
                                ->where('sub_status', 'waiting_indent')->count(),
            'selesai_hari_ini' => $selesaiHariIni,
            'selesai_growth'   => $selesaiGrowth,
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

        $stats = [
            'pengerjaan'        => $todayPengerjaan,
            'pengerjaan_growth' => $growthPengerjaan,
            'antrian'           => ServiceTicket::where('status', 'antrian')->count(),
            'menunggu_part'    => ServiceTicket::where('status', 'menunggu part')->count(),        
            'menunggu_approval'=> ServiceTicket::where('status', 'menunggu part')                  
                                ->where('sub_status', 'waiting_approval')->count(),
            'menunggu_indent'  => ServiceTicket::where('status', 'menunggu part')                   
                                ->where('sub_status', 'waiting_indent')->count(),
            'selesai_hari_ini'  => ServiceTicket::where('status', 'selesai')
                                ->whereDate('updated_at', today())->count(),
            'urgent'            => ServiceTicket::where('status', 'antrian')
                                ->whereNull('user_id')->count(),
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

        // Hitung Pendapatan Bulan Ini & Bulan Lalu untuk Tren Pertumbuhan
        $pendapatanBulanIni = \App\Models\Payment::where('status', 'lunas')
            ->whereMonth('tanggal_bayar', now()->month)
            ->whereYear('tanggal_bayar', now()->year)
            ->sum('total');
            
        $pendapatanBulanLalu = \App\Models\Payment::where('status', 'lunas')
            ->whereMonth('tanggal_bayar', now()->subMonth()->month)
            ->whereYear('tanggal_bayar', now()->subMonth()->year)
            ->sum('total');

        $growthPendapatan = 0;
        if ($pendapatanBulanLalu > 0) {
            $growthPendapatan = round((($pendapatanBulanIni - $pendapatanBulanLalu) / $pendapatanBulanLalu) * 100, 1);
        } elseif ($pendapatanBulanIni > 0) {
            $growthPendapatan = 100.0;
        }

        // Hitung Keuntungan Bulan Ini & Bulan Lalu untuk Tren Keuntungan Bersih
        $biayaPartBulanIni = \App\Models\Payment::where('status', 'lunas')
            ->whereMonth('tanggal_bayar', now()->month)
            ->whereYear('tanggal_bayar', now()->year)
            ->sum('biaya_sparepart');
        $keuntunganBulanIni = $pendapatanBulanIni - $biayaPartBulanIni;

        $biayaPartBulanLalu = \App\Models\Payment::where('status', 'lunas')
            ->whereMonth('tanggal_bayar', now()->subMonth()->month)
            ->whereYear('tanggal_bayar', now()->subMonth()->year)
            ->sum('biaya_sparepart');
        $keuntunganBulanLalu = $pendapatanBulanLalu - $biayaPartBulanLalu;

        $growthKeuntungan = 0;
        if ($keuntunganBulanLalu > 0) {
            $growthKeuntungan = round((($keuntunganBulanIni - $keuntunganBulanLalu) / $keuntunganBulanLalu) * 100, 1);
        } elseif ($keuntunganBulanIni > 0) {
            $growthKeuntungan = 100.0;
        }

        $perangkatSelesai = ServiceTicket::where('status', 'selesai')->count();
        $totalTicket      = ServiceTicket::count();

        // Rata-rata waktu servis (hari dari created_at ke updated_at saat selesai)
        $avgWaktu = ServiceTicket::where('status', 'selesai')
            ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_hari')
            ->value('avg_hari');

        // Hitung Rata-rata Waktu Servis Bulan Ini & Bulan Lalu untuk Tren
        $avgWaktuBulanIni = ServiceTicket::where('status', 'selesai')
            ->whereMonth('updated_at', now()->month)
            ->whereYear('updated_at', now()->year)
            ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_hari')
            ->value('avg_hari') ?? 0;

        $avgWaktuBulanLalu = ServiceTicket::where('status', 'selesai')
            ->whereMonth('updated_at', now()->subMonth()->month)
            ->whereYear('updated_at', now()->subMonth()->year)
            ->selectRaw('AVG(DATEDIFF(updated_at, created_at)) as avg_hari')
            ->value('avg_hari') ?? 0;

        $growthWaktu = 0;
        if ($avgWaktuBulanLalu > 0) {
            $growthWaktu = round((($avgWaktuBulanIni - $avgWaktuBulanLalu) / $avgWaktuBulanLalu) * 100, 1);
        }

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
            'growthPendapatan', 'growthKeuntungan', 'growthWaktu',
            'perangkatSelesai', 'totalTicket',
            'avgWaktu', 'chartData', 'teknisiPerforma'
        ));
    }

    public function downloadPdf(Request $request)
    {
        $request->validate([
            'dari_tanggal'  => ['required', 'date'],
            'sampai_tanggal'=> ['required', 'date', 'after_or_equal:dari_tanggal'],
        ]);

        $dari    = Carbon::parse($request->dari_tanggal)->startOfDay();
        $sampai  = Carbon::parse($request->sampai_tanggal)->endOfDay();

        // ── Data tiket selesai dalam rentang tanggal ──
        $tickets = ServiceTicket::with([
                'user',
                'payment',
                'sparepartUsages.sparepart',
            ])
            ->whereBetween('updated_at', [$dari, $sampai])
            ->where('status', 'selesai')
            ->orderBy('updated_at', 'asc')
            ->get();

        // ── Ringkasan sparepart yang digunakan ──
        $sparepartSummary = \App\Models\SparepartUsage::with('sparepart')
            ->whereHas('serviceTicket', function ($q) use ($dari, $sampai) {
                $q->whereBetween('updated_at', [$dari, $sampai])
                ->where('status', 'selesai');
            })
            ->get()
            ->groupBy('sparepart_id')
            ->map(function ($usages) {
                return [
                    'nama'            => $usages->first()->sparepart->nama,
                    'total_digunakan' => $usages->sum('jumlah_digunakan'),
                    'total_harga'     => $usages->sum('total_harga'),
                ];
            })
            ->values();

        // ── Performa teknisi ──
        $teknisiSummary = $tickets
            ->groupBy('user_id')
            ->map(function ($ticketsByTeknisi) {
                $teknisi       = $ticketsByTeknisi->first()->user;
                $totalPendapatan = $ticketsByTeknisi->sum(function ($t) {
                    return $t->payment ? ($t->payment->biaya_sparepart + $t->payment->biaya_jasa) : 0;
                });

                return [
                    'nama'             => $teknisi?->name ?? 'Tidak Ditugaskan',
                    'jumlah_tiket'     => $ticketsByTeknisi->count(),
                    'total_pendapatan' => $totalPendapatan,
                ];
            })
            ->values();

        // ── Ringkasan keuangan ──
        $totalPendapatan   = $tickets->sum(fn($t) => $t->payment?->biaya_sparepart + $t->payment?->biaya_jasa ?? 0);
        $totalBiayaPart    = $tickets->sum(fn($t) => $t->payment?->biaya_sparepart ?? 0);
        $totalBiayaJasa    = $tickets->sum(fn($t) => $t->payment?->biaya_jasa ?? 0);
        $jumlahPelanggan   = $tickets->pluck('nama_pelanggan')->unique()->count();
        $jumlahTiketSelesai = $tickets->count();

        $data = [
            'tickets'            => $tickets,
            'sparepartSummary'   => $sparepartSummary,
            'teknisiSummary'     => $teknisiSummary,
            'totalPendapatan'    => $totalPendapatan,
            'totalBiayaPart'     => $totalBiayaPart,
            'totalBiayaJasa'     => $totalBiayaJasa,
            'jumlahPelanggan'    => $jumlahPelanggan,
            'jumlahTiketSelesai' => $jumlahTiketSelesai,
            'dari'               => $dari,
            'sampai'             => $sampai,
            'generated_at'       => Carbon::now(),
        ];

        $pdf = Pdf::loadView('admin.reports-pdf', $data)
            ->setPaper('a4', 'landscape')
            ->setOptions([
                'defaultFont' => 'sans-serif',
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled'      => false,
            ]);

        $filename = 'Laporan-ServiTrack-'
            . $dari->format('d-m-Y')
            . '-sd-'
            . $sampai->format('d-m-Y')
            . '.pdf';

        return $pdf->download($filename);
    }
}