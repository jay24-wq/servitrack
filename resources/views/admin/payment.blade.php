@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- Page Header --}}
    <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Modul Pembayaran</h1>
        <p class="text-gray-400 mt-1">Proses transaksi dan penyerahan perangkat pelanggan.</p>
    </div>

    @if(session('success'))
    <div id="toast" class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm font-semibold transition-opacity duration-500 opacity-100">
        {{ session('success') }}
    </div>
    <script>
        setTimeout(() => {
            const t = document.getElementById('toast');
            if (t) { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 500); }
        }, 3000);
    </script>
    @endif

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {{-- ================================================================
            LEFT PANEL — Pencarian & Info Tiket
        ================================================================ --}}
        <div class="lg:col-span-2 space-y-4">

            {{-- Search Box --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Pencarian Tiket / No Resi</p>
                <form method="GET" action="{{ route('admin.payment.search') }}" class="flex gap-3">
                    <input type="text" name="kode"
                        value="{{ request('kode') }}"
                        placeholder="e.g. SRV-20240610-A1B2"
                        autofocus
                        class="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                    <button type="submit"
                            class="px-5 py-2.5 bg-[#14161a] hover:bg-gray-800 border border-gray-700 text-white text-sm font-semibold rounded-lg transition">
                        Cari
                    </button>
                </form>

                @if(isset($error))
                <p class="text-red-400 text-xs">{{ $error }}</p>
                @endif
            </div>

            {{-- Ticket Info --}}
            @if(isset($ticket) && $ticket)
            <div class="bg-[#14161a] border border-blue-500/30 rounded-xl p-6 space-y-5">

                {{-- Ticket ID + Status --}}
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ticket ID</p>
                        <p class="text-2xl font-bold text-white mt-1 font-mono">{{ $ticket->kode_servis }}</p>
                    </div>
                    @php
                        $statusConfig = [
                            'antrian'         => 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                            'pengecekan'      => 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                            'menunggu part'   => 'bg-orange-500/10 border-orange-500/20 text-orange-400',
                            'pengerjaan'      => 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
                            'quality control' => 'bg-purple-500/10 border-purple-500/20 text-purple-400',
                            'siap diambil'    => 'bg-teal-500/10 border-teal-500/20 text-teal-400',
                            'selesai'         => 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
                        ];
                        $cfg = $statusConfig[$ticket->status] ?? 'bg-gray-500/10 border-gray-500/20 text-gray-400';
                    @endphp
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider {{ $cfg }}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ ucfirst($ticket->status) }}
                    </span>
                </div>

                <div class="border-t border-gray-800"></div>

                {{-- Pelanggan & Perangkat --}}
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-gray-600">Pelanggan</p>
                        <div class="flex items-center gap-2 mt-2">
                            <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                                {{ strtoupper(substr($ticket->nama_pelanggan, 0, 2)) }}
                            </div>
                            <span class="text-sm font-semibold text-white">{{ $ticket->nama_pelanggan }}</span>
                        </div>
                    </div>
                    <div>
                        <p class="text-[10px] font-bold uppercase tracking-widest text-gray-600">Perangkat</p>
                        <div class="flex items-center gap-2 mt-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span class="text-sm font-semibold text-white">{{ $ticket->device_name }} {{ $ticket->device_brand }}</span>
                        </div>
                    </div>
                </div>

                {{-- Log Perbaikan --}}
                @if($ticket->keluhan)
                <div class="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Log Perbaikan (Summary)</p>
                    <p class="text-xs text-gray-400 leading-relaxed">{{ $ticket->keluhan }}</p>
                </div>
                @endif
            </div>
            @else
            {{-- Empty State --}}
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-10 flex flex-col items-center justify-center text-center space-y-3">
                <div class="w-12 h-12 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <p class="text-sm font-semibold text-gray-500">Belum ada tiket dipilih</p>
                <p class="text-xs text-gray-600">Cari nomor resi di atas untuk memulai proses pembayaran</p>
            </div>
            @endif
        </div>

        {{-- ================================================================
            RIGHT PANEL — Rincian Biaya & Form Pembayaran
        ================================================================ --}}
        <div class="lg:col-span-3">
            <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">

                {{-- Panel Header --}}
                <div class="px-6 py-5 border-b border-gray-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <span class="text-white font-semibold text-sm">Rincian Biaya</span>
                    </div>
                    @if(isset($ticket) && $ticket)
                    <span class="text-xs font-mono text-gray-500 bg-gray-900 border border-gray-800 px-3 py-1 rounded-lg">
                        {{ $ticket->kode_servis }}
                    </span>
                    @endif
                </div>

                @if(isset($ticket) && $ticket)
                <form method="POST" action="{{ route('admin.payment.store') }}" id="payment-form">
                    @csrf
                    <input type="hidden" name="service_ticket_id" value="{{ $ticket->id }}">

                    {{-- Rincian Biaya --}}
                    <div class="px-6 py-5 space-y-4">

                        {{-- Biaya Sparepart --}}
                        <div class="flex items-start justify-between gap-4 pb-4 border-b border-gray-800/60">
                            <div class="flex-1">
                                <p class="text-sm font-semibold text-white">Biaya Suku Cadang</p>
                                <p class="text-xs text-gray-500 mt-0.5">{{ $ticket->device_name }} {{ $ticket->device_brand }}</p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-[10px] text-gray-600 mb-1">Rp</p>
                                <input type="number" name="biaya_sparepart"
                                    value="{{ $ticket->payment?->biaya_sparepart ?? 0 }}"
                                    min="0" step="1000"
                                    id="input-sparepart"
                                    class="w-36 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-blue-500 transition"
                                    oninput="hitungTotal()">
                            </div>
                        </div>

                        {{-- Biaya Jasa --}}
                        <div class="flex items-start justify-between gap-4 pb-4 border-b border-gray-800/60">
                            <div class="flex-1">
                                <p class="text-sm font-semibold text-white">Biaya Jasa Teknisi</p>
                                <p class="text-xs text-gray-500 mt-0.5">
                                    {{ $ticket->user ? $ticket->user->name : 'Teknisi belum ditugaskan' }}
                                </p>
                            </div>
                            <div class="text-right shrink-0">
                                <p class="text-[10px] text-gray-600 mb-1">Rp</p>
                                <input type="number" name="biaya_jasa"
                                    value="{{ $ticket->payment?->biaya_jasa ?? 0 }}"
                                    min="0" step="1000"
                                    id="input-jasa"
                                    class="w-36 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-blue-500 transition"
                                    oninput="hitungTotal()">
                            </div>
                        </div>

                        {{-- Total --}}
                        <div class="bg-gray-900/60 border border-gray-800 rounded-xl px-6 py-5 flex items-center justify-between">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Total Pembayaran</p>
                            <p class="text-3xl font-bold text-white" id="display-total">
                                Rp {{ number_format(($ticket->payment?->biaya_sparepart ?? 0) + ($ticket->payment?->biaya_jasa ?? 0), 0, ',', '.') }}
                            </p>
                        </div>

                        {{-- Catatan --}}
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                Catatan <span class="text-gray-600 normal-case font-normal">(opsional)</span>
                            </label>
                            <textarea name="catatan" rows="2"
                                    placeholder="e.g. Garansi 30 hari untuk part yang diganti..."
                                    class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition resize-none">{{ $ticket->payment?->catatan }}</textarea>
                        </div>

                        {{-- Metode Pembayaran --}}
                        <div class="space-y-3">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Metode Pembayaran</p>
                            <div class="grid grid-cols-3 gap-3">
                                @foreach([
                                    ['value' => 'tunai', 'label' => 'Tunai', 'icon' => 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z'],
                                    ['value' => 'qris', 'label' => 'QRIS', 'icon' => 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z'],
                                    ['value' => 'transfer', 'label' => 'Transfer Bank', 'icon' => 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z'],
                                ] as $metode)
                                <label class="cursor-pointer">
                                    <input type="radio" name="metode" value="{{ $metode['value'] }}"
                                        class="peer hidden"
                                        {{ ($ticket->payment?->metode ?? 'tunai') === $metode['value'] ? 'checked' : '' }}>
                                    <div class="flex flex-col items-center gap-2 p-4 bg-gray-900 border border-gray-800 rounded-xl
                                                peer-checked:border-blue-500/50 peer-checked:bg-blue-500/5 peer-checked:text-blue-400
                                                text-gray-500 hover:border-gray-700 hover:text-gray-300 transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="{{ $metode['icon'] }}" />
                                        </svg>
                                        <span class="text-xs font-semibold">{{ $metode['label'] }}</span>
                                    </div>
                                </label>
                                @endforeach
                            </div>
                        </div>
                    </div>

                    {{-- Submit Button --}}
                    <div class="px-6 pb-6">
                        <button type="submit"
                                class="w-full py-4 bg-blue-600/20 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Proses Transaksi & Cetak Nota
                        </button>
                    </div>
                </form>

                @else
                {{-- Empty State Right Panel --}}
                <div class="px-6 py-20 flex flex-col items-center justify-center text-center space-y-3">
                    <div class="w-14 h-14 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p class="text-sm font-semibold text-gray-600">Rincian biaya akan muncul di sini</p>
                    <p class="text-xs text-gray-700">Cari dan pilih tiket terlebih dahulu</p>
                </div>
                @endif
            </div>
        </div>

    </div>
</div>
@endsection

@push('scripts')
<script>
    function hitungTotal() {
        const sparepart = parseInt(document.getElementById('input-sparepart').value) || 0;
        const jasa      = parseInt(document.getElementById('input-jasa').value) || 0;
        const total     = sparepart + jasa;

        document.getElementById('display-total').textContent =
            'Rp ' + total.toLocaleString('id-ID');
    }
</script>
@endpush