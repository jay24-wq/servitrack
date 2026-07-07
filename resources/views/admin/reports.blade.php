@extends('layouts.app')

@section('title', 'Reports - ServiTrack')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- Page Header --}}
    <div class="flex items-start justify-between">
        <div>
            <h1 class="text-4xl font-bold text-white tracking-tight">Laporan & Analisis Bisnis</h1>
            <p class="text-gray-400 mt-1">Pemantauan performa finansial dan teknis real-time.</p>
        </div>
        <div class="relative">
            <select class="bg-[#14161a] border border-gray-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer">
                <option>Bulan Ini</option>
                <option>3 Bulan Terakhir</option>
                <option>6 Bulan Terakhir</option>
                <option>Tahun Ini</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
        {{-- Form Download PDF --}}
        <form method="GET" action="{{ route('admin.reports.downloadPdf') }}"
            class="bg-[#14161a] border border-gray-800 rounded-xl p-6"
            target="_blank">

            <div class="flex items-end gap-4 flex-wrap">
                <div>
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-2">
                        Dari Tanggal
                    </label>
                    <input type="date" name="dari_tanggal"
                        value="{{ request('dari_tanggal', now()->startOfMonth()->format('Y-m-d')) }}"
                        class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white
                            focus:outline-none focus:border-blue-500">
                </div>

                <div>
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-2">
                        Sampai Tanggal
                    </label>
                    <input type="date" name="sampai_tanggal"
                        value="{{ request('sampai_tanggal', now()->format('Y-m-d')) }}"
                        class="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white
                            focus:outline-none focus:border-blue-500">
                </div>

                <button type="submit"
                    class="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30
                        hover:border-blue-500 text-blue-400 hover:text-white font-semibold px-5 py-2.5
                        rounded-xl text-sm transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download PDF
                </button>
            </div>

        </form>
    </div>

    {{-- ================================================================
        STAT CARDS
    ================================================================ --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {{-- Total Pendapatan --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <span class="text-[10px] font-bold text-emerald-400">+12.5% ↗</span>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Pendapatan</p>
                <p class="text-2xl font-bold text-white mt-1">
                    Rp {{ number_format($totalPendapatan / 1000000, 1, '.', ',') }}M
                </p>
            </div>
        </div>

        {{-- Keuntungan Bersih --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                </div>
                <span class="text-[10px] font-bold text-emerald-400">+8.2% ↗</span>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Keuntungan Bersih</p>
                <p class="text-2xl font-bold text-white mt-1">
                    Rp {{ number_format($keuntunganBersih / 1000000, 1, '.', ',') }}M
                </p>
            </div>
        </div>

        {{-- Perangkat Selesai --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <span class="text-[10px] font-bold text-gray-500">{{ number_format($totalTicket) }} Total</span>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Perangkat Selesai</p>
                <div class="flex items-end gap-2 mt-1">
                    <p class="text-2xl font-bold text-white">{{ number_format($perangkatSelesai) }}</p>
                    <p class="text-sm text-gray-500 mb-0.5">Unit</p>
                </div>
            </div>
        </div>

        {{-- Rata-rata Waktu Servis --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-3">
            <div class="flex items-center justify-between">
                <div class="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <span class="text-[10px] font-bold text-red-400">-4% ↘</span>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Rata-rata Waktu Servis</p>
                <div class="flex items-end gap-2 mt-1">
                    <p class="text-2xl font-bold text-white">{{ number_format($avgWaktu ?? 0, 1) }}</p>
                    <p class="text-sm text-gray-500 mb-0.5">Hari</p>
                </div>
            </div>
        </div>
    </div>

    {{-- ================================================================
        CHART + KATEGORI
    ================================================================ --}}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {{-- Tren Keuntungan --}}
        <div class="lg:col-span-2 bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div class="flex items-start justify-between">
                <div>
                    <h3 class="text-white font-semibold">Tren Keuntungan Bersih</h3>
                    <p class="text-xs text-gray-500 mt-0.5">6 Bulan Terakhir</p>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-500">
                    <span class="w-2 h-2 rounded-full bg-indigo-400/50 inline-block"></span>
                    Target tercapai
                </div>
            </div>

            {{-- Bar Chart --}}
            <div class="flex items-end justify-between gap-3 h-44 pt-4">
                @foreach($chartData as $d)
                <div class="flex flex-col items-center gap-2 flex-1">
                    <span class="text-[9px] text-gray-600">
                        {{ $d['value'] > 0 ? 'Rp ' . number_format($d['value'] / 1000000, 1) . 'M' : '' }}
                    </span>
                    <div class="w-full rounded-md bg-gray-700/50 hover:bg-indigo-500/40 transition cursor-default"
                         style="height: {{ $d['height'] }}%"
                         title="Rp {{ number_format($d['value'], 0, ',', '.') }}">
                    </div>
                    <span class="text-[10px] text-gray-500">{{ $d['label'] }}</span>
                </div>
                @endforeach
            </div>
        </div>

        {{-- Kategori Kerusakan --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
                <h3 class="text-white font-semibold">Kategori Kerusakan Terpopuler</h3>
            </div>

            <div class="space-y-4">
                @foreach([
                    ['label' => 'LCD Replacement',  'pct' => 45, 'color' => 'bg-blue-500'],
                    ['label' => 'Battery Issues',    'pct' => 25, 'color' => 'bg-amber-500'],
                    ['label' => 'Logic Board Repair','pct' => 20, 'color' => 'bg-indigo-500'],
                    ['label' => 'Lain-lain',         'pct' => 10, 'color' => 'bg-gray-600'],
                ] as $kategori)
                <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-gray-300">{{ $kategori['label'] }}</span>
                        <span class="text-xs font-bold {{ $kategori['color'] === 'bg-blue-500' ? 'text-blue-400' : ($kategori['color'] === 'bg-amber-500' ? 'text-amber-400' : ($kategori['color'] === 'bg-indigo-500' ? 'text-indigo-400' : 'text-gray-400')) }}">
                            {{ $kategori['pct'] }}%
                        </span>
                    </div>
                    <div class="w-full bg-gray-800 rounded-full h-1.5">
                        <div class="{{ $kategori['color'] }} h-1.5 rounded-full transition-all duration-500"
                             style="width: {{ $kategori['pct'] }}%"></div>
                    </div>
                </div>
                @endforeach
            </div>

            <button class="w-full pt-2 text-xs text-gray-500 hover:text-white transition flex items-center justify-center gap-1">
                Lihat Detail Kategori
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    </div>

    {{-- ================================================================
        PERFORMA TEKNISI
    ================================================================ --}}
    <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">

        {{-- Header --}}
        <div class="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
            <h3 class="text-white font-semibold">Performa Kecepatan Teknisi</h3>
        </div>

        {{-- Table --}}
        <table class="w-full text-left">
            <thead>
                <tr class="border-b border-gray-800 text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-gray-900/30">
                    <th class="px-6 py-4">Nama Teknisi</th>
                    <th class="px-6 py-4">Tiket Selesai</th>
                    <th class="px-6 py-4">Rata-rata Waktu (Hari)</th>
                    <th class="px-6 py-4">Skor Kualitas (0-100)</th>
                    <th class="px-6 py-4 text-center">Trend</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60">
                @forelse($teknisiPerforma as $tek)
                <tr class="hover:bg-gray-900/20 transition">

                    {{-- Nama --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {{ strtoupper(substr($tek['nama'], 0, 2)) }}
                            </div>
                            <span class="font-semibold text-white text-sm">{{ $tek['nama'] }}</span>
                        </div>
                    </td>

                    {{-- Tiket Selesai --}}
                    <td class="px-6 py-4">
                        <span class="text-white font-bold text-sm">{{ $tek['tiket_selesai'] }}</span>
                    </td>

                    {{-- Rata-rata Waktu --}}
                    <td class="px-6 py-4">
                        @php
                            $waktuColor = $tek['avg_hari'] <= 1.5 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                        : ($tek['avg_hari'] <= 2.5 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400');
                        @endphp
                        <span class="px-3 py-1 rounded-lg border text-xs font-bold {{ $waktuColor }}">
                            {{ $tek['avg_hari'] }} Hari
                        </span>
                    </td>

                    {{-- Skor Kualitas --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="flex-1 bg-gray-800 rounded-full h-1.5 max-w-[120px]">
                                <div class="h-1.5 rounded-full
                                    {{ $tek['skor'] >= 90 ? 'bg-blue-500' : ($tek['skor'] >= 75 ? 'bg-amber-500' : 'bg-red-500') }}"
                                     style="width: {{ $tek['skor'] }}%"></div>
                            </div>
                            <span class="text-xs text-gray-400 font-medium w-6 text-right">{{ $tek['skor'] }}</span>
                        </div>
                    </td>

                    {{-- Trend --}}
                    <td class="px-6 py-4 text-center">
                        @if($tek['trend'] === 'up')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        @elseif($tek['trend'] === 'flat')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        @else
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            </svg>
                        @endif
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-gray-600 text-sm">
                        Belum ada data performa teknisi
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>

        {{-- Load More --}}
        @if($teknisiPerforma->count() >= 4)
        <div class="px-6 py-4 border-t border-gray-800 text-center">
            <button class="text-xs text-gray-500 hover:text-white transition flex items-center gap-1 mx-auto">
                Muat Lebih Banyak
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
        </div>
        @endif
    </div>

</div>
@endsection