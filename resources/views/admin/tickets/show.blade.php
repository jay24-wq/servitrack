@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- Breadcrumb --}}
    <div class="flex items-center gap-2 text-xs text-gray-500">
        <a href="{{ route('admin.queue') }}" class="hover:text-white transition">Ticket Queue</a>
        <span>›</span>
        <span class="text-gray-300">#{{ $ticket->kode_servis }}</span>
    </div>

    {{-- Header --}}
    <div class="flex items-start justify-between gap-4">
        <div>
            <h1 class="text-4xl font-bold text-white tracking-tight">Detail Tiket</h1>
            <p class="text-gray-400 mt-1">Informasi lengkap dan catatan teknisi untuk tiket ini.</p>
        </div>
        <a href="{{ route('admin.queue') }}"
            class="text-xs text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 bg-[#14161a] px-4 py-2 rounded-lg transition flex items-center gap-2 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Kembali ke Queue
        </a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {{-- KOLOM KIRI: Info tiket + catatan teknisi --}}
        <div class="lg:col-span-2 space-y-6">

            {{-- Info Perangkat & Pelanggan --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <h3 class="text-sm font-bold text-white">Informasi Tiket</h3>
                    <span class="font-mono text-xs text-blue-400 font-bold">#{{ $ticket->kode_servis }}</span>
                </div>
                <div class="p-6 grid grid-cols-2 gap-5">
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Nama Pelanggan</p>
                        <p class="text-white font-semibold text-sm">{{ $ticket->nama_pelanggan }}</p>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Nomor HP</p>
                        <p class="text-white text-sm">{{ $ticket->nomor_hp }}</p>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Perangkat</p>
                        <p class="text-white font-semibold text-sm">{{ $ticket->device_name }} {{ $ticket->device_brand }}</p>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Serial Number</p>
                        <p class="text-white font-mono text-xs">{{ $ticket->device_serial ?? '-' }}</p>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Tanggal Masuk</p>
                        <p class="text-white text-sm">{{ \Carbon\Carbon::parse($ticket->checkin_date)->translatedFormat('d F Y') }}</p>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Kondisi Fisik</p>
                        <p class="text-gray-300 text-sm">{{ $ticket->device_condition ?? '-' }}</p>
                    </div>
                    <div class="col-span-2">
                        <p class="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Keluhan Pelanggan</p>
                        <p class="text-gray-300 text-sm leading-relaxed bg-gray-900/40 border border-gray-800/60 rounded-lg p-3">
                            {{ $ticket->keluhan ?? 'Tidak ada keluhan yang dicatat.' }}
                        </p>
                    </div>
                </div>
            </div>

            {{-- Catatan Teknisi --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-800">
                    <h3 class="text-sm font-bold text-white">Catatan Teknisi</h3>
                    <p class="text-xs text-gray-500 mt-0.5">Hasil diagnosis dan tindakan yang dilakukan oleh teknisi.</p>
                </div>
                <div class="p-6">
                    @if($ticket->catatan_teknisi)

                        @php
                            // Pisahkan bagian [INDENT] dari catatan utama jika ada
                            $catatanRaw   = $ticket->catatan_teknisi;
                            $hasIndent    = str_contains($catatanRaw, '[INDENT]');
                            $parts        = explode("\n\n[INDENT]", $catatanRaw);
                            $catatanUtama = trim($parts[0]);
                            $infoIndent   = $hasIndent ? trim(str_replace('Komponen yang dibutuhkan:', '', $parts[1] ?? '')) : null;
                        @endphp

                        {{-- Catatan utama diagnosis --}}
                        <div class="bg-gray-900/40 border border-gray-800/60 rounded-lg p-4 text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                            {{ $catatanUtama }}
                        </div>

                        {{-- Box khusus jika ada indent komponen (Kondisi C) --}}
                        @if($hasIndent && $infoIndent)
                        <div class="mt-4 bg-sky-500/5 border border-sky-500/20 rounded-xl p-4 flex items-start gap-3">
                            <div class="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-sky-400 uppercase tracking-wider">Permintaan Pengadaan Part (Indent)</p>
                                <p class="text-sm text-white font-semibold mt-1">{{ trim($infoIndent) }}</p>
                                <p class="text-[11px] text-gray-500 mt-1">
                                    Teknisi melaporkan komponen ini habis di gudang dan perlu dipesan segera.
                                </p>
                                {{-- Shortcut ke halaman sparepart --}}
                                <a href="{{ route('admin.sparepart.index') }}"
                                    class="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-sky-400 hover:text-sky-300 transition">
                                    Buka Manajemen Inventaris
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </a>
                            </div>
                        </div>
                        @endif

                        {{-- Box khusus jika perangkat rusak total (Kondisi D) --}}
                        @if($ticket->sub_status === 'unrepairable')
                        <div class="mt-4 bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                            <div class="p-2 bg-red-500/10 border border-red-500/20 rounded-lg shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-xs font-bold text-red-400 uppercase tracking-wider">Perangkat Tidak Bisa Diperbaiki</p>
                                <p class="text-[11px] text-gray-500 mt-1">
                                    Teknisi menandai perangkat ini mengalami kerusakan permanen.
                                    Pelanggan hanya dikenakan biaya pengecekan fisik.
                                </p>
                            </div>
                        </div>
                        @endif

                    @else
                        <div class="flex flex-col items-center justify-center py-8 text-center">
                            <div class="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </div>
                            <p class="text-sm text-gray-600">Teknisi belum menambahkan catatan diagnosis.</p>
                        </div>
                    @endif
                </div>
            </div>

            {{-- Sparepart yang Digunakan --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">
                <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white">Sparepart Digunakan</h3>
                        <p class="text-xs text-gray-500 mt-0.5">Komponen yang dipakai teknisi dalam pengerjaan ini.</p>
                    </div>
                    @if($ticket->sparepartUsages->count() > 0)
                    <span class="text-xs font-bold text-white bg-gray-800 border border-gray-700 px-2.5 py-1 rounded-lg">
                        {{ $ticket->sparepartUsages->count() }} item
                    </span>
                    @endif
                </div>

                @if($ticket->sparepartUsages->count() > 0)
                <div class="divide-y divide-gray-800/60">
                    @foreach($ticket->sparepartUsages as $usage)
                    <div class="px-6 py-4 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm font-semibold text-white">{{ $usage->sparepart->nama }}</p>
                                <p class="text-[11px] text-gray-500 mt-0.5">
                                    {{ $usage->jumlah_digunakan }} unit × Rp {{ number_format($usage->sparepart->harga_satuan, 0, ',', '.') }}
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-bold text-white">
                                Rp {{ number_format($usage->total_harga, 0, ',', '.') }}
                            </p>
                            <p class="text-[10px] text-gray-600 mt-0.5">snapshot harga</p>
                        </div>
                    </div>
                    @endforeach
                </div>

                {{-- Total biaya sparepart --}}
                <div class="px-6 py-4 border-t border-gray-800 bg-gray-900/20 flex items-center justify-between">
                    <span class="text-xs font-bold uppercase tracking-wider text-gray-500">Total Biaya Sparepart</span>
                    <span class="text-sm font-bold text-white">
                        Rp {{ number_format($ticket->sparepartUsages->sum('total_harga'), 0, ',', '.') }}
                    </span>
                </div>

                @else
                <div class="px-6 py-10 text-center">
                    <p class="text-sm text-gray-600">Belum ada sparepart yang dicatat untuk tiket ini.</p>
                </div>
                @endif
            </div>
        </div>

        {{-- KOLOM KANAN: Status + Teknisi + Biaya --}}
        <div class="space-y-6">

            {{-- Status Tiket --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
                <h3 class="text-sm font-bold text-white">Status Tiket</h3>

                @php
                    $statusConfig = [
                        'antrian'         => ['bg' => 'bg-amber-500/10 border-amber-500/20', 'text' => 'text-amber-400', 'dot' => 'bg-amber-400'],
                        'pengecekan'      => ['bg' => 'bg-blue-500/10 border-blue-500/20', 'text' => 'text-blue-400', 'dot' => 'bg-blue-400'],
                        'menunggu part'   => ['bg' => 'bg-orange-500/10 border-orange-500/20', 'text' => 'text-orange-400', 'dot' => 'bg-orange-400 animate-pulse'],
                        'pengerjaan'      => ['bg' => 'bg-indigo-500/10 border-indigo-500/20', 'text' => 'text-indigo-400', 'dot' => 'bg-indigo-400 animate-pulse'],
                        'quality control' => ['bg' => 'bg-purple-500/10 border-purple-500/20', 'text' => 'text-purple-400', 'dot' => 'bg-purple-400'],
                        'siap diambil'    => ['bg' => 'bg-teal-500/10 border-teal-500/20', 'text' => 'text-teal-400', 'dot' => 'bg-teal-400'],
                        'selesai'         => ['bg' => 'bg-emerald-500/10 border-emerald-500/20', 'text' => 'text-emerald-400', 'dot' => 'bg-emerald-400'],
                    ];
                    $cfg = $statusConfig[$ticket->status] ?? ['bg' => 'bg-gray-500/10 border-gray-500/20', 'text' => 'text-gray-400', 'dot' => 'bg-gray-400'];
                @endphp

                <span class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase tracking-wider {{ $cfg['bg'] }} {{ $cfg['text'] }}">
                    <span class="w-2 h-2 rounded-full {{ $cfg['dot'] }}"></span>
                    {{ $ticket->status }}
                </span>

                {{-- Sub-status badge --}}
                @if($ticket->sub_status === 'waiting_approval')
                <div class="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse block shrink-0"></span>
                    <p class="text-[11px] text-orange-400 font-semibold">Menunggu Approval WA Pelanggan</p>
                </div>
                @elseif($ticket->sub_status === 'waiting_indent')
                <div class="flex items-center gap-2 bg-sky-500/5 border border-sky-500/20 rounded-lg px-3 py-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-sky-400 block shrink-0"></span>
                    <p class="text-[11px] text-sky-400 font-semibold">Menunggu Pengadaan Part (Indent)</p>
                </div>
                @elseif($ticket->sub_status === 'unrepairable')
                <div class="flex items-center gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-red-500 block shrink-0"></span>
                    <p class="text-[11px] text-red-400 font-semibold">Tidak Bisa Diperbaiki</p>
                </div>
                @endif

                {{-- Update status manual oleh Admin --}}
                <form action="{{ route('admin.tickets.updateStatus', $ticket) }}" method="POST" class="pt-2 border-t border-gray-800">
                    @csrf
                    @method('PATCH')
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-2">
                        Update Status Manual
                    </label>
                    <div class="flex gap-2">
                        <select name="status"
                            class="flex-1 bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-blue-500">
                            @foreach(['antrian','pengecekan','menunggu part','pengerjaan','quality control','siap diambil','selesai'] as $s)
                            <option value="{{ $s }}" {{ $ticket->status === $s ? 'selected' : '' }}>
                                {{ ucfirst($s) }}
                            </option>
                            @endforeach
                        </select>
                        <button type="submit"
                            class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
                            Simpan
                        </button>
                    </div>
                </form>
            </div>

            {{-- Teknisi --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
                <h3 class="text-sm font-bold text-white">Teknisi Pengerjaan</h3>
                @if($ticket->user)
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {{ strtoupper(substr($ticket->user->name, 0, 2)) }}
                    </div>
                    <div>
                        <p class="text-white font-semibold text-sm">{{ $ticket->user->name }}</p>
                        <p class="text-xs text-gray-500">{{ $ticket->user->email }}</p>
                    </div>
                </div>
                @else
                <p class="text-sm text-gray-600">Belum ada teknisi yang ditugaskan.</p>
                @endif
            </div>

            {{-- Biaya --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
                <h3 class="text-sm font-bold text-white">Informasi Biaya</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-xs text-gray-500">Estimasi Awal</span>
                        <span class="text-sm font-semibold text-white">
                            Rp {{ number_format($ticket->total_biaya ?? 0, 0, ',', '.') }}
                        </span>
                    </div>
                    @if($ticket->estimasi_baru)
                    <div class="flex justify-between items-center pt-2 border-t border-gray-800">
                        <span class="text-xs text-orange-400 font-semibold">Estimasi Baru (Revisi)</span>
                        <span class="text-sm font-bold text-orange-400">
                            Rp {{ number_format($ticket->estimasi_baru, 0, ',', '.') }}
                        </span>
                    </div>
                    @endif
                </div>
            </div>

            {{-- Timeline singkat --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
                <h3 class="text-sm font-bold text-white">Timeline</h3>
                <div class="space-y-3">
                    <div class="flex items-start gap-2.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0"></span>
                        <div>
                            <p class="text-xs text-white font-semibold">Tiket Dibuat</p>
                            <p class="text-[11px] text-gray-500">{{ $ticket->created_at->translatedFormat('d M Y, H:i') }}</p>
                        </div>
                    </div>
                    <div class="flex items-start gap-2.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-gray-600 mt-1.5 shrink-0"></span>
                        <div>
                            <p class="text-xs text-white font-semibold">Terakhir Diperbarui</p>
                            <p class="text-[11px] text-gray-500">{{ $ticket->updated_at->translatedFormat('d M Y, H:i') }}</p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </div>
</div>
@endsection