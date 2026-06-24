@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- Page Header --}}
    <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Ringkasan Dashboard</h1>
        <p class="text-gray-400 mt-1">Selamat datang kembali. Berikut adalah aktivitas bengkel hari ini.</p>
    </div>

    {{-- ================================================================
        STAT CARDS
    ================================================================ --}}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

        {{-- Card 1: Tiket Baru --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>

                @if($stats['antrian'] > 0)
                <span class="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
                    Perlu Tindakan
                </span>
                @endif
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Tiket Baru</p>
                <div class="flex items-end gap-2">
                    <span class="text-4xl font-bold text-white">{{ $stats['antrian'] }}</span>
                    <span class="text-sm text-gray-500 mb-1">Tiket unassigned</span>
                </div>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1">
                <div class="bg-blue-500 h-1 rounded-full" style="width: {{ $stats['total'] > 0 ? ($stats['antrian'] / $stats['total']) * 100 : 0 }}%"></div>
            </div>
        </div>

        {{-- Card 2: Selesai Hari Ini --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                @if($stats['selesai_hari_ini'] > 0)
                <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                    +{{ $stats['selesai_growth'] }}% vs Kemarin
                </span>
                @endif
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Selesai Hari Ini</p>
                <div class="flex items-end gap-2">
                    <span class="text-4xl font-bold text-white">{{ $stats['selesai_hari_ini'] }}</span>
                    <span class="text-sm text-gray-500 mb-1">Perangkat siap ambil</span>
                </div>
            </div>
            <div class="w-full bg-gray-800 rounded-full h-1">
                <div class="bg-emerald-500 h-1 rounded-full" style="width: {{ $stats['total'] > 0 ? ($stats['selesai_hari_ini'] / max($stats['total'], 1)) * 100 : 0 }}%"></div>
            </div>
        </div>

        {{-- Card 3: Pendapatan Harian --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>

                @if($stats['pendapatan_hari_ini'] >= $stats['target_pendapatan'])
                <span class="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                    Target Tercapai
                </span>
                @else
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-1 rounded">
                    Belum Tercapai
                </span>
                @endif
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Pendapatan Harian</p>
                <div class="flex items-end gap-2">
                    <span class="text-4xl font-bold text-white">Rp {{ number_format($stats['pendapatan_hari_ini'] / 1000, 0, ',', '.') }}</span>
                    <span class="text-sm text-gray-500 mb-1">IDR</span>
                </div>
            </div>
            @php
                $progress = min(100, round(($stats['pendapatan_hari_ini'] / $stats['target_pendapatan']) * 100));
            @endphp
            <div class="w-full bg-gray-800 rounded-full h-1">
                <div class="bg-amber-500 h-1 rounded-full" style="width: {{ $progress }}%;"></div>
            </div>
        </div>
    </div>

    {{-- ================================================================
        CHART + TIKET TERBARU
    ================================================================ --}}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {{-- Tren Perbaikan --}}
        <div class="lg:col-span-2 bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-800 pb-4">
                <div>
                    <h3 class="text-white font-semibold text-sm">Tren Perbaikan</h3>
                    <p class="text-gray-500 text-xs mt-0.5">Volume perbaikan 7 hari terakhir</p>
                </div>
                <div class="relative">
                    <select class="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 appearance-none pr-7 cursor-pointer">
                        <option>7 Hari Terakhir</option>
                        <option>30 Hari Terakhir</option>
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {{-- Bar Chart --}}
            <div class="flex items-end justify-between gap-2 h-40 pt-4">
                @foreach($chartData as $day)
                <div class="flex flex-col items-center gap-2 flex-1">
                    <div class="w-full rounded-md transition-all duration-300 {{ $day['is_today'] ? 'bg-blue-500/60' : 'bg-gray-700/60' }} hover:opacity-80"
                        style="height: {{ $day['height'] }}%"
                        title="{{ $day['count'] }} tiket"></div>
                    <span class="text-[10px] text-gray-500">{{ $day['label'] }}</span>
                </div>
                @endforeach
            </div>
        </div>

        {{-- Tiket Terbaru --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-gray-800 pb-4">
                <h3 class="text-white font-semibold text-sm">Tiket Terbaru</h3>
            </div>

            <div class="space-y-3">
                @forelse($recentTickets as $ticket)
                <div class="flex items-start gap-3 border-l-2 border-blue-500/50 pl-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-mono text-blue-400">#{{ $ticket->kode_servis }}</span>
                            <span class="text-[10px] text-gray-600 whitespace-nowrap">{{ $ticket->created_at->diffForHumans() }}</span>
                        </div>
                        <p class="text-xs font-semibold text-white mt-0.5 truncate">
                            {{ $ticket->device_name }} {{ $ticket->device_brand ? '- ' . $ticket->device_brand : '' }}
                        </p>
                        <p class="text-[10px] text-gray-500">Pemilik: {{ $ticket->nama_pelanggan }}</p>
                    </div>
                </div>
                @empty
                <p class="text-xs text-gray-600 text-center py-4">Belum ada tiket hari ini</p>
                @endforelse
            </div>

            <a href="{{ route('admin.queue') }}"
                class="w-full py-2 text-center text-xs font-semibold text-blue-400 hover:text-blue-300 border border-gray-800 hover:border-blue-500/30 rounded-lg block transition">
                Lihat Semua Tiket
            </a>
        </div>
    </div>

    {{-- ================================================================
        STOK HAMPIR HABIS + KAPASITAS TEKNISI
    ================================================================ --}}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        {{-- Stok Hampir Habis --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 flex items-center gap-6">
            <div class="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 14l2 2 4-4" />
                </svg>
            </div>
            <div class="flex-1">
                <h3 class="text-white font-bold text-sm">Stok Hampir Habis</h3>
                <p class="text-gray-400 text-xs mt-1">
                    {{ $stokKritis }} komponen kritis perlu segera restock untuk menghindari delay.
                </p>
                <a href="{{ route('admin.sparepart.index') }}"
                    class="inline-block mt-3 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition">
                    Pesan Sekarang
                </a>
            </div>
        </div>

        {{-- Kapasitas Teknisi --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 flex items-center gap-6">
            <div class="flex -space-x-3 shrink-0">
                @foreach($teknisiAktif as $index => $tek)
                <div class="w-12 h-12 rounded-full bg-gradient-to-tr
                    {{ $index === 0 ? 'from-blue-500 to-indigo-600' : ($index === 1 ? 'from-amber-500 to-orange-600' : 'from-gray-600 to-gray-700') }}
                    border-2 border-[#14161a] flex items-center justify-center text-xs font-bold text-white">
                    {{ strtoupper(substr($tek->name, 0, 2)) }}
                </div>
                @endforeach
            </div>
            <div class="flex-1">
                <h3 class="text-white font-bold text-sm">Kapasitas Teknisi</h3>
                <p class="text-gray-400 text-xs mt-1">
                    {{ $teknisiAktif->count() }} Teknisi Aktif
                    ({{ $teknisiOnDuty }} On-Duty, {{ $teknisiAktif->count() - $teknisiOnDuty }} Istirahat)
                </p>
                <div class="flex items-center gap-1.5 mt-3">
                    @foreach($teknisiAktif as $index => $tek)
                    <span class="w-2.5 h-2.5 rounded-full {{ $index < $teknisiOnDuty ? 'bg-emerald-500' : 'bg-gray-600' }}"></span>
                    @endforeach
                </div>
            </div>
        </div>
    </div>

</div>
@endsection