@extends('layouts.app')

@section('content')
<div class="max-w-2xl mx-auto px-6 py-10 space-y-6">

    {{-- Flash success --}}
    @if(session('success'))
    <div class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm font-semibold">
        {{ session('success') }}
    </div>
    @endif

    {{-- Nota Card --}}
    <div class="bg-[#14161a] border border-gray-800 rounded-2xl overflow-hidden" id="nota-print">

        {{-- Header Nota --}}
        <div class="bg-gray-900/60 px-8 py-6 text-center border-b border-gray-800">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">ServiTrack</p>
            <h2 class="text-xl font-bold text-white">Nota Pembayaran</h2>
            <p class="text-xs text-gray-500 mt-1">
                {{ $ticket->payment->tanggal_bayar->translatedFormat('d F Y, H:i') }} WIB
            </p>
        </div>

        <div class="px-8 py-6 space-y-5">

            {{-- Kode & Status --}}
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-[10px] uppercase tracking-widest text-gray-500">No. Resi</p>
                    <p class="font-mono font-bold text-white text-lg mt-0.5">{{ $ticket->kode_servis }}</p>
                </div>
                <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span>
                    LUNAS
                </span>
            </div>

            <div class="border-t border-gray-800/60"></div>

            {{-- Info Pelanggan --}}
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-[10px] uppercase tracking-widest text-gray-500">Pelanggan</p>
                    <p class="text-sm font-semibold text-white mt-1">{{ $ticket->nama_pelanggan }}</p>
                    <p class="text-xs text-gray-500">{{ $ticket->nomor_hp }}</p>
                </div>
                <div>
                    <p class="text-[10px] uppercase tracking-widest text-gray-500">Perangkat</p>
                    <p class="text-sm font-semibold text-white mt-1">{{ $ticket->device_name }} {{ $ticket->device_brand }}</p>
                    <p class="text-xs text-gray-500">S/N: {{ $ticket->device_serial ?? '-' }}</p>
                </div>
            </div>

            <div class="border-t border-gray-800/60"></div>

            {{-- Rincian Sparepart --}}
            @if($ticket->sparepartUsages->count() > 0)
            <div class="space-y-2">
                <p class="text-[10px] uppercase tracking-widest text-gray-500">Suku Cadang Diganti</p>
                @foreach($ticket->sparepartUsages as $usage)
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-300">
                        {{ $usage->sparepart->nama }}
                        <span class="text-gray-500 text-xs">× {{ $usage->jumlah_digunakan }}</span>
                    </span>
                    <span class="text-white font-medium">
                        Rp {{ number_format($usage->total_harga, 0, ',', '.') }}
                    </span>
                </div>
                @endforeach
            </div>
            @endif

            {{-- Rincian Biaya --}}
            <div class="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-2">
                <div class="flex justify-between text-sm">
                    <span class="text-gray-400">Biaya Suku Cadang</span>
                    <span class="text-white">Rp {{ number_format($ticket->payment->biaya_sparepart, 0, ',', '.') }}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-gray-400">Biaya Jasa Teknisi</span>
                    <span class="text-white">Rp {{ number_format($ticket->payment->biaya_jasa, 0, ',', '.') }}</span>
                </div>
                <div class="border-t border-gray-800 pt-2 flex justify-between">
                    <span class="text-sm font-bold text-white">Total</span>
                    <span class="text-lg font-bold text-white">
                        Rp {{ number_format($ticket->payment->biaya_sparepart + $ticket->payment->biaya_jasa, 0, ',', '.') }}
                    </span>
                </div>
            </div>

            {{-- Metode Bayar --}}
            <div class="flex justify-between items-center">
                <p class="text-[10px] uppercase tracking-widest text-gray-500">Metode Pembayaran</p>
                <p class="text-sm font-bold text-white uppercase">
                    {{ $ticket->payment->metode }}
                    @if($ticket->payment->bank)
                        — {{ $ticket->payment->bank }}
                    @endif
                </p>
            </div>

            @if($ticket->payment->catatan)
            <div class="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3">
                <p class="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Catatan</p>
                <p class="text-xs text-gray-400">{{ $ticket->payment->catatan }}</p>
            </div>
            @endif

        </div>

        {{-- Footer Nota --}}
        <div class="px-8 py-5 border-t border-gray-800 bg-gray-900/30 text-center">
            <p class="text-xs text-gray-500">Terima kasih telah mempercayakan perangkat Anda kepada kami.</p>
            <p class="text-[11px] text-gray-600 mt-1">Garansi servis berlaku sesuai ketentuan yang berlaku.</p>
        </div>
    </div>

    {{-- Actions --}}
    <div class="flex gap-3">
        <button onclick="window.print()"
            class="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 text-blue-400 hover:text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Cetak Nota
        </button>
        <a href="{{ route('admin.payment') }}"
            class="flex-1 py-3 bg-[#14161a] hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2">
            Transaksi Baru
        </a>
    </div>

</div>

<style>
    @media print {
        body * { visibility: hidden; }
        #nota-print, #nota-print * { visibility: visible; }
        #nota-print { position: absolute; left: 0; top: 0; width: 100%; }
    }
</style>
@endsection