@extends('layouts.teknisi')

@section('title', 'My Tasks - ServiTrack')

@section('content')

<div class="h-full overflow-x-auto overflow-y-hidden p-6">
    <div class="flex gap-7 h-full" style="min-width: max-content;">

        @foreach($columns as $status => $col)
        @php
            $borderColors = [
                'antrian'         => 'border-gray-600/60',
                'pengecekan'      => 'border-amber-500/60',
                'menunggu part'   => 'border-orange-500/60',
                'pengerjaan'      => 'border-blue-500/60',
                'quality control' => 'border-purple-500/60',
                'siap diambil'    => 'border-teal-500/60',
                'selesai'         => 'border-emerald-500/60',
            ];
            $dotColors = [
                'antrian'         => 'bg-gray-500',
                'pengecekan'      => 'bg-amber-500',
                'menunggu part'   => 'bg-orange-500',
                'pengerjaan'      => 'bg-blue-500',
                'quality control' => 'bg-purple-500',
                'siap diambil'    => 'bg-teal-500',
                'selesai'         => 'bg-emerald-500',
            ];
            $textColors = [
                'antrian'         => 'text-gray-400',
                'pengecekan'      => 'text-amber-400',
                'menunggu part'   => 'text-orange-400',
                'pengerjaan'      => 'text-blue-400',
                'quality control' => 'text-purple-400',
                'siap diambil'    => 'text-teal-400',
                'selesai'         => 'text-emerald-400',
            ];
        @endphp

        <div class="w-72 shrink-0 h-full border-r border-gray-900/50 flex flex-col">

            {{-- Column Header --}}
            <div class="px-4 py-4 border-b border-t-2 {{ $borderColors[$status] }} border-b-gray-900/50 bg-[#0f1115] shrink-0">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full {{ $dotColors[$status] }}"></span>
                        <span class="text-[10px] font-bold uppercase tracking-widest {{ $textColors[$status] }}">
                            {{ $col['label'] }}
                        </span>
                    </div>
                    <span class="text-[10px] font-bold text-gray-600 bg-gray-900 border border-gray-800 w-5 h-5 rounded flex items-center justify-center">
                        {{ $col['count'] }}
                    </span>
                </div>
            </div>

            {{-- Cards --}}
            <div class="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0b0c0f]">
                @forelse($col['tickets'] as $ticket)
                @php
                    $isUrgent      = $status === 'menunggu part';
                    $isPending     = $status === 'pengerjaan';
                    $isUnrepairable = $ticket->sub_status === 'unrepairable';

                    // Tentukan warna border-left kartu
                    $cardBorderLeft = '';
                    if ($isUnrepairable)                          $cardBorderLeft = 'border-l-2 border-l-red-500';
                    elseif ($ticket->sub_status === 'waiting_approval') $cardBorderLeft = 'border-l-2 border-l-orange-500';
                    elseif ($ticket->sub_status === 'waiting_indent')   $cardBorderLeft = 'border-l-2 border-l-sky-500';
                    elseif ($isPending)                           $cardBorderLeft = 'border-l-2 border-l-blue-500';
                @endphp

                <div class="bg-[#14161a] border border-gray-800 rounded-xl p-4 space-y-3
                            hover:border-gray-700 transition group {{ $cardBorderLeft }}">

                    {{-- Ticket ID + Icon --}}
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-mono text-gray-600">#{{ $ticket->kode_servis }}</span>
                        <div class="flex items-center gap-1.5">
                            @if($isUnrepairable)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            @elseif($ticket->sub_status === 'waiting_approval')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            @elseif($ticket->sub_status === 'waiting_indent')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                            </svg>
                            @elseif($status === 'siap diambil')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            @elseif($status === 'selesai')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            @elseif($status === 'quality control')
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            @endif
                        </div>
                    </div>

                    {{-- SUB-BADGE — muncul hanya di kolom "menunggu part" --}}
                    @if($status === 'menunggu part')
                    <div class="flex">
                        @if($ticket->sub_status === 'waiting_approval')
                        <span class="inline-flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            <span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse block"></span>
                            Menunggu Approval WA
                        </span>
                        @elseif($ticket->sub_status === 'waiting_indent')
                        <span class="inline-flex items-center gap-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            <span class="w-1.5 h-1.5 rounded-full bg-sky-400 block"></span>
                            Menunggu Indent / Order Part
                        </span>
                        @endif
                    </div>
                    @endif

                    {{-- Sub-badge Rusak Total di kolom siap diambil --}}
                    @if($isUnrepairable)
                    <div class="flex">
                        <span class="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500 block"></span>
                            Tidak Bisa Diperbaiki
                        </span>
                    </div>
                    @endif

                    {{-- Device --}}
                    <div>
                        <p class="text-sm font-bold text-white leading-tight">
                            {{ $ticket->device_name }} {{ $ticket->device_brand }}
                        </p>
                        <p class="text-[10px] text-gray-500 mt-0.5 truncate">
                            {{ Str::limit($ticket->keluhan, 40) }}
                        </p>
                    </div>

                    {{-- Pelanggan --}}
                    <div class="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span class="text-[10px] text-gray-500">{{ $ticket->nama_pelanggan }}</span>
                    </div>

                    {{-- Waktu --}}
                    <div class="flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 {{ $isUrgent ? 'text-orange-400' : 'text-gray-600' }}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="text-[10px] {{ $isUrgent ? 'text-orange-400 font-semibold' : 'text-gray-600' }}">
                            {{ $ticket->updated_at->diffForHumans() }}
                        </span>
                    </div>

                    {{-- Action Bar --}}
                    <div class="flex items-center justify-between pt-1 border-t border-gray-800/60">
                        <button type="button"
                            onclick="openDetailModal(this)"
                            data-id="{{ $ticket->id }}"
                            data-status="{{ $status }}"
                            data-sub-status="{{ $ticket->sub_status ?? '' }}"
                            data-kode="{{ $ticket->kode_servis }}"
                            data-device="{{ $ticket->device_name }} {{ $ticket->device_brand }}"
                            data-pelanggan="{{ $ticket->nama_pelanggan }}"
                            data-keluhan="{{ e($ticket->keluhan) }}"
                            data-estimasi="{{ number_format($ticket->total_biaya ?? 0, 0, ',', '.') }}"
                            data-catatan="{{ e($ticket->catatan_teknisi ?? '') }}"
                            data-wa-locked="{{ $ticket->sub_status === 'waiting_approval' ? 'true' : 'false' }}"
                            class="text-[9px] font-bold uppercase tracking-wider
                                {{ $isPending ? 'text-blue-400 border border-blue-500/30 bg-blue-500/5' : 'text-gray-500 border border-gray-800 bg-transparent' }}
                                px-3 py-1.5 rounded-lg hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5 transition">
                            Buka Detail
                        </button>

                        {{-- Quick Status Dropdown --}}
                        @if($status !== 'selesai' && $ticket->sub_status !== 'waiting_approval')
                        <div class="relative group/menu">
                            <button class="p-1.5 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                </svg>
                            </button>
                            <div class="hidden group-hover/menu:block absolute right-0 bottom-8 w-44 bg-[#14161a] border border-gray-800 rounded-xl shadow-2xl z-20 overflow-hidden">
                                @php
                                    $nextStatuses = [
                                        'antrian'         => ['pengecekan'],
                                        'pengecekan'      => ['menunggu part', 'pengerjaan'],
                                        'menunggu part'   => ['pengerjaan'],
                                        'pengerjaan'      => ['quality control'],
                                        'quality control' => ['siap diambil'],
                                        'siap diambil'    => ['selesai'],
                                    ];
                                    $next = $nextStatuses[$status] ?? [];
                                @endphp
                                @foreach($next as $nextStatus)
                                <form method="POST" action="{{ route('teknisi.tickets.updateStatus', $ticket) }}">
                                    @csrf
                                    @method('PATCH')
                                    <input type="hidden" name="status" value="{{ $nextStatus }}">
                                    <button type="submit" class="w-full text-left px-3 py-2 text-[10px] text-gray-400 hover:text-white hover:bg-gray-800 transition capitalize">
                                        → {{ ucfirst($nextStatus) }}
                                    </button>
                                </form>
                                @endforeach
                            </div>
                        </div>
                        @elseif($ticket->sub_status === 'waiting_approval')
                        {{-- Dropdown dikunci saat menunggu approval WA --}}
                        <span class="text-[9px] text-orange-400/50 px-2 italic">Terkunci</span>
                        @else
                        <span class="text-[9px] text-gray-700 px-2">
                            {{ $ticket->status === 'selesai' ? 'Paid' : '' }}
                        </span>
                        @endif
                    </div>
                </div>
                @empty
                <div class="h-24 flex items-center justify-center">
                    <p class="text-[10px] text-gray-700 text-center">Tidak ada tiket</p>
                </div>
                @endforelse
            </div>
        </div>
        @endforeach
    </div>
</div>


{{-- ═══════════════════════════════════════════════════════════════════ --}}
{{--                     MODAL DETAIL TIKET                             --}}
{{-- ═══════════════════════════════════════════════════════════════════ --}}
<div id="ticketDetailModal"
        class="fixed inset-0 z-50 hidden bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onclick="handleBackdropClick(event)">

    <div class="bg-[#0f1115] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-white shadow-2xl">

        {{-- Header --}}
        <div class="p-5 border-b border-gray-800 flex items-start justify-between shrink-0">
            <div>
                <span id="modalTicketCode" class="text-xs font-mono text-gray-500">#-</span>
                <h3 id="modalDeviceName" class="text-base font-bold text-white mt-0.5">-</h3>
            </div>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white p-1.5 rounded-lg bg-gray-900 border border-gray-800 transition text-xs shrink-0 ml-4">
                ✕ Tutup
            </button>
        </div>

        {{-- Body --}}
        <div class="p-6 overflow-y-auto space-y-5">

            {{-- Info Dasar --}}
            <div class="grid grid-cols-2 gap-4 bg-[#14161a] p-4 rounded-xl border border-gray-800/50">
                <div>
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">Nama Pelanggan</label>
                    <p id="modalCustomerName" class="text-white font-medium mt-0.5 text-sm">-</p>
                </div>
                <div>
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">Estimasi Biaya Awal</label>
                    <p id="modalInitialCost" class="text-amber-400 font-bold mt-0.5 text-sm">Rp 0</p>
                </div>
                <div class="col-span-2 border-t border-gray-800/40 pt-3">
                    <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">Keluhan Perangkat</label>
                    <p id="modalComplaint" class="text-gray-400 mt-1 italic text-xs leading-relaxed">-</p>
                </div>
            </div>

            {{-- Banner WA Locked (hanya muncul jika sub_status = waiting_approval) --}}
            <div id="waBanner" class="hidden items-center gap-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                    <p class="text-xs font-bold text-orange-400">Form Terkunci — Menunggu Persetujuan Pelanggan</p>
                    <p class="text-[11px] text-gray-500 mt-0.5">Rincian biaya sudah terkirim ke WhatsApp pelanggan. Formulir tidak bisa diubah sampai pelanggan merespons.</p>
                </div>
            </div>

            {{-- Container Form Dinamis --}}
            <form id="modalActionForm" method="POST" action="">
                @csrf
                @method('PATCH')
                <div id="dynamicFormContainer"></div>
                <div id="modalFooterButtons" class="mt-5 pt-4 border-t border-gray-800 flex justify-end gap-3"></div>
            </form>

        </div>
    </div>
</div>


{{-- ═══════════════════════════════════════════════════════════════════ --}}
{{--                     JAVASCRIPT LOGIC                               --}}
{{-- ═══════════════════════════════════════════════════════════════════ --}}
<script>
const BASE_URL = "{{ url('/teknisi/tickets') }}";

// ── Buka Modal ────────────────────────────────────────────────────────
function openDetailModal(btn) {
    const ticketId     = btn.dataset.id;
    const currentStatus = btn.dataset.status;
    const subStatus    = btn.dataset.subStatus;

    const data = {
        kode         : btn.dataset.kode,
        device       : btn.dataset.device,
        pelanggan    : btn.dataset.pelanggan,
        keluhan      : btn.dataset.keluhan,
        estimasi_awal: btn.dataset.estimasi,
        catatan      : btn.dataset.catatan,
        wa_locked    : btn.dataset.waLocked === 'true',
    };

    const modal    = document.getElementById('ticketDetailModal');
    const form     = document.getElementById('modalActionForm');
    const waBanner = document.getElementById('waBanner');

    // Isi header info
    document.getElementById('modalTicketCode').innerText   = '#' + data.kode;
    document.getElementById('modalDeviceName').innerText   = data.device;
    document.getElementById('modalCustomerName').innerText = data.pelanggan;
    document.getElementById('modalInitialCost').innerText  = 'Rp ' + data.estimasi_awal;
    document.getElementById('modalComplaint').innerText    = data.keluhan || '-';

    // Set action URL
    form.action = BASE_URL + '/' + ticketId + '/update-detail';

    // Tampilkan atau sembunyikan banner WA locked
    waBanner.classList.toggle('hidden', !data.wa_locked);
    waBanner.classList.toggle('flex',    data.wa_locked);

    // Render konten form sesuai status
    renderFormByStatus(currentStatus, subStatus, data.wa_locked, data);

    modal.classList.remove('hidden');
}

// ── Render Form Dinamis ───────────────────────────────────────────────
function renderFormByStatus(status, subStatus, waLocked, data) {
    const container = document.getElementById('dynamicFormContainer');
    const footer    = document.getElementById('modalFooterButtons');
    container.innerHTML = '';
    footer.innerHTML    = '';

    const disabledAttr = waLocked ? 'disabled' : '';
    const lockedStyle  = waLocked ? 'opacity-40 pointer-events-none select-none' : '';

    switch (status) {

        // ────── ANTRIAN ──────
        case 'antrian':
            container.innerHTML = `
                <div class="p-4 bg-gray-900/40 border border-gray-800 rounded-xl text-xs text-gray-400 leading-relaxed">
                    Perangkat ini berada di antrian kerja Anda. Klik tombol di bawah untuk
                    memulai proses pengecekan fisik dan diagnosis kerusakan.
                </div>
                <input type="hidden" name="kondisi" value="ANTRIAN_TO_PENGECEKAN">
                <input type="hidden" name="catatan_teknisi" value="Mulai pengecekan dari antrian.">
            `;
            footer.innerHTML = `
                <button type="submit"
                    class="bg-amber-500 hover:bg-amber-600 text-black font-bold px-5 py-2 rounded-xl text-xs transition">
                    Mulai Pengecekan
                </button>
            `;
            break;

        // ────── PENGECEKAN ──────
        case 'pengecekan':
            container.innerHTML = `
                <div class="space-y-5 ${lockedStyle}">

                    {{-- Catatan Teknisi --}}
                    <div>
                        <label class="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                            Hasil Diagnosis Teknisi (Wajib)
                        </label>
                        <textarea name="catatan_teknisi" required ${disabledAttr} rows="3"
                            class="w-full bg-[#0b0c0f] border border-gray-800 rounded-xl mt-1.5 p-3 text-xs
                                    focus:border-amber-500 focus:outline-none text-white resize-none"
                            placeholder="Tuliskan detail kerusakan fisik / mesin yang ditemukan...">${data.catatan}</textarea>
                    </div>

                    {{-- Pilih Kondisi --}}
                    <div>
                        <span class="text-xs font-bold text-white block mb-3">Pilih Kondisi Kelanjutan Perbaikan</span>
                        <div class="space-y-2">

                            {{-- Kondisi A --}}
                            <label class="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-800 rounded-xl
                                            cursor-pointer hover:border-orange-500/40 transition has-[:checked]:border-orange-500/50
                                            has-[:checked]:bg-orange-500/5">
                                <input type="radio" name="kondisi_pilih" value="A" ${disabledAttr}
                                    class="mt-0.5 accent-orange-500 shrink-0"
                                    onchange="onKondisiChange('A')" checked>
                                <div>
                                    <p class="text-xs font-bold text-orange-400">
                                        Kondisi A — Ada Kerusakan Tambahan
                                    </p>
                                    <p class="text-[11px] text-gray-500 mt-0.5">
                                        Kirim rincian harga baru ke WhatsApp pelanggan untuk meminta persetujuan digital.
                                    </p>
                                </div>
                            </label>

                            {{-- Kondisi B --}}
                            <label class="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-800 rounded-xl
                                            cursor-pointer hover:border-blue-500/40 transition has-[:checked]:border-blue-500/50
                                            has-[:checked]:bg-blue-500/5">
                                <input type="radio" name="kondisi_pilih" value="B" ${disabledAttr}
                                    class="mt-0.5 accent-blue-500 shrink-0"
                                    onchange="onKondisiChange('B')">
                                <div>
                                    <p class="text-xs font-bold text-blue-400">
                                        Kondisi B — Aman / Sesuai Keluhan Awal
                                    </p>
                                    <p class="text-[11px] text-gray-500 mt-0.5">
                                        Tidak ada biaya tambahan. Langsung eksekusi perbaikan.
                                    </p>
                                </div>
                            </label>

                            {{-- Kondisi C --}}
                            <label class="flex items-start gap-3 p-3 bg-gray-900/30 border border-gray-800 rounded-xl
                                            cursor-pointer hover:border-sky-500/40 transition has-[:checked]:border-sky-500/50
                                            has-[:checked]:bg-sky-500/5">
                                <input type="radio" name="kondisi_pilih" value="C" ${disabledAttr}
                                    class="mt-0.5 accent-sky-500 shrink-0"
                                    onchange="onKondisiChange('C')">
                                <div>
                                    <p class="text-xs font-bold text-sky-400">
                                        Kondisi C — Suku Cadang Gudang Kosong (Indent)
                                    </p>
                                    <p class="text-[11px] text-gray-500 mt-0.5">
                                        Kerusakan terdeteksi namun stok komponen habis. Tandai untuk order ke Admin.
                                    </p>
                                </div>
                            </label>

                            {{-- Kondisi D --}}
                            <label class="flex items-start gap-3 p-3 bg-gray-900/30 border border-red-900/30 rounded-xl
                                            cursor-pointer hover:border-red-500/40 transition has-[:checked]:border-red-500/50
                                            has-[:checked]:bg-red-500/5">
                                <input type="radio" name="kondisi_pilih" value="D" ${disabledAttr}
                                    class="mt-0.5 accent-red-500 shrink-0"
                                    onchange="onKondisiChange('D')">
                                <div>
                                    <p class="text-xs font-bold text-red-400">
                                        Kondisi D — Perangkat Rusak Total / Tidak Bisa Diperbaiki
                                    </p>
                                    <p class="text-[11px] text-gray-500 mt-0.5">
                                        Kerusakan permanen. Perangkat dikembalikan ke pelanggan, hanya bayar biaya cek fisik.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {{-- Panel Kondisi A: Form Quotation --}}
                    <div id="panelKondisiA" class="space-y-3 bg-orange-950/10 border border-orange-900/30 p-4 rounded-xl">
                        <span class="text-xs font-bold text-orange-400 block">Form Estimasi Biaya Tambahan</span>

                        {{-- Dropdown Sparepart dari DB --}}
                        <div>
                            <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                                Pilih Komponen dari Gudang
                            </label>
                            <div id="sparepartLoadingState"
                                class="flex items-center gap-2 bg-[#0b0c0f] border border-gray-800 rounded-lg p-2.5 text-xs text-gray-500">
                                <svg class="animate-spin h-3 w-3 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                </svg>
                                Memuat daftar komponen...
                            </div>
                            <select name="id_sparepart" id="selectSparepart" ${disabledAttr}
                                class="hidden w-full bg-[#0b0c0f] border border-gray-800 rounded-lg p-2.5 text-xs
                                    text-white focus:border-orange-500 focus:outline-none"
                                onchange="onSparepartChange(this)">
                                <option value="">-- Pilih Komponen --</option>
                            </select>
                        </div>

                        {{-- Info Stok & Harga (muncul setelah pilih komponen) --}}
                        <div id="sparepartInfo" class="hidden grid grid-cols-2 gap-2">
                            <div class="bg-[#0b0c0f] border border-gray-800 rounded-lg p-2.5">
                                <p class="text-[10px] text-gray-500 mb-0.5">Sisa Stok</p>
                                <p id="infoStok" class="text-xs font-bold text-white">-</p>
                            </div>
                            <div class="bg-[#0b0c0f] border border-gray-800 rounded-lg p-2.5">
                                <p class="text-[10px] text-gray-500 mb-0.5">Harga Satuan</p>
                                <p id="infoHarga" class="text-xs font-bold text-orange-400">-</p>
                            </div>
                        </div>

                        {{-- Hidden input harga part (diisi otomatis dari dropdown) --}}
                        <input type="hidden" name="harga_part_tambahan" id="inputHargaPart" value="0">
                        <input type="hidden" name="nama_part_tambahan" id="inputNamaPart" value="">

                        {{-- Biaya Jasa (dipatok Rp 50.000) --}}
                        <div>
                            <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                                Biaya Jasa Teknisi
                            </label>
                            <div class="flex items-center bg-gray-900/60 border border-gray-800 rounded-lg p-2.5 gap-2">
                                <span class="text-xs text-gray-500">Rp</span>
                                <span class="text-xs font-bold text-white">50.000</span>
                                <span class="text-[10px] text-gray-600 ml-auto italic">Tarif tetap</span>
                            </div>
                            <input type="hidden" name="biaya_jasa_tambahan" value="50000">
                        </div>

                        {{-- Total Estimasi Baru (auto-hitung) --}}
                        <div>
                            <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                                Total Estimasi Baru
                            </label>
                            <div class="bg-orange-950/30 border border-orange-900/50 rounded-lg p-2.5 flex items-center justify-between">
                                <span class="text-xs text-gray-500">Harga Komponen + Rp 50.000 jasa</span>
                                <span id="displayTotal" class="text-sm font-bold text-orange-400">Rp 0</span>
                            </div>
                            <input type="hidden" name="total_estimasi_baru" id="inputTotalEstimasi" value="0">
                        </div>

                        <input type="hidden" name="kondisi" id="inputKondisiHidden" value="A">
                    </div>

                    {{-- ══ PANEL KONDISI C ══ --}}
                    <div id="panelKondisiC" class="hidden space-y-3 bg-sky-950/10 border border-sky-900/30 p-4 rounded-xl">
                        <span class="text-xs font-bold text-sky-400 block">Informasi Komponen yang Dibutuhkan</span>
                        <div>
                            <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500 block mb-1">
                                Nama Komponen yang Stoknya Habis
                            </label>
                            <input type="text" name="nama_komponen_indent" id="inputKomponenIndent"
                                class="w-full bg-[#0b0c0f] border border-sky-900/40 rounded-lg p-2.5 text-xs text-white
                                    focus:border-sky-500 focus:outline-none"
                                placeholder="Contoh: LCD iPhone 13 Pro, IC Charger MacBook Air M2...">
                            <p class="text-[11px] text-gray-600 mt-1.5">
                                Nama ini akan dikirim ke Admin sebagai referensi pengadaan barang.
                            </p>
                        </div>
                    </div>

                    {{-- Panel Kondisi D: Input Komponen Rusak --}}
                    <div id="panelKondisiD" class="hidden space-y-3 bg-red-950/10 border border-red-900/30 p-4 rounded-xl">
                        <span class="text-xs font-bold text-red-400 block">Konfirmasi Kerusakan Permanen</span>
                        <input type="text" name="komponen_rusak" ${disabledAttr}
                            class="w-full bg-[#0b0c0f] border border-red-900/40 rounded-lg p-2.5 text-xs text-white"
                            placeholder="Contoh: IC Charger hangus, Motherboard korosi parah">
                        <p class="text-[11px] text-red-400/70">
                            Status tiket akan langsung berpindah ke <strong>Siap Diambil</strong>
                            dan catatan rusak total akan tersimpan otomatis.
                        </p>
                    </div>

                </div>
            `;

            // Default button untuk Kondisi A
            footer.innerHTML = buildFooterButton('A', waLocked);

            if (!waLocked) {
                fetchSpareparts();
            }
            break;

        // ────── MENUNGGU PART ──────
        case 'menunggu part':
            const isApproval = subStatus === 'waiting_approval';
            const isIndent   = subStatus === 'waiting_indent';

            container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-6 rounded-2xl text-center space-y-3
                    ${isApproval
                        ? 'bg-orange-500/5 border border-orange-500/20'
                        : 'bg-sky-500/5 border border-sky-500/20'}">
                    <span class="text-3xl">${isApproval ? '⏳' : '📦'}</span>
                    <h4 class="text-sm font-bold ${isApproval ? 'text-orange-400' : 'text-sky-400'}">
                        ${isApproval ? 'Menunggu Persetujuan Pelanggan' : 'Menunggu Pengadaan Suku Cadang'}
                    </h4>
                    <p class="text-xs text-gray-400 max-w-sm">
                        ${isApproval
                            ? 'Link persetujuan digital telah dikirim ke WhatsApp pelanggan. Kartu otomatis berpindah setelah pelanggan merespons.'
                            : 'Suku cadang yang dibutuhkan sedang dalam proses pemesanan oleh Admin. Tunggu konfirmasi stok masuk.'}
                    </p>
                </div>
            `;
            footer.innerHTML = `
                <button type="button" onclick="closeModal()"
                    class="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-xs transition">
                    Tutup
                </button>
            `;
            break;

        // ────── PENGERJAAN ──────
        case 'pengerjaan':
            container.innerHTML = `
                <div class="space-y-4">
                    <div class="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl text-xs text-blue-400">
                        Pelanggan menyetujui pengerjaan. Selesaikan perbaikan fisik perangkat, lalu pilih suku cadang yang digunakan.
                    </div>

                    {{-- Sparepart Components --}}
                    <div>
                        <label class="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                            Suku Cadang Gudang yang Digunakan
                        </label>

                        {{-- Container untuk baris-baris sparepart --}}
                        <div id="sparepart-container" class="space-y-2 mt-1.5">
                            {{-- Baris pertama akan ditambahkan oleh JavaScript --}}
                        </div>

                        {{-- Tombol tambah baris --}}
                        <button type="button" onclick="tambahBarisSparepart()"
                            class="mt-2 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Tambah Komponen
                        </button>
                    </div>

                    {{-- Catatan Akhir Perbaikan --}}
                    <div>
                        <label class="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                            Catatan Akhir Perbaikan
                        </label>
                        <textarea name="catatan_selesai" rows="2"
                            class="w-full bg-[#0b0c0f] border border-gray-800 rounded-xl mt-1.5 p-3
                                    text-xs text-white focus:border-blue-500 focus:outline-none resize-none"
                            placeholder="Contoh: Berhasil ganti IC Power dan re-pasta thermal..."></textarea>
                    </div>

                    <input type="hidden" name="kondisi" value="B">
                    <input type="hidden" name="status"  value="quality control">
                </div>
            `;

            // Footer tombol submit
            footer.innerHTML = `
                <button type="submit"
                    class="bg-blue-500 hover:bg-blue-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition">
                    Kirim ke Quality Control
                </button>
            `;

            // Inisialisasi: tambahkan baris pertama
            tambahBarisSparepart();

            // Fetch data sparepart (diambil satu kali untuk semua baris)
            fetchSpareparts();
            break;

        // ────── QUALITY CONTROL ──────
        case 'quality control':
            container.innerHTML = `
                <div class="space-y-4">
                    <span class="text-xs font-bold text-purple-400 block">Checklist Pengujian Layanan (QC)</span>
                    <div class="grid grid-cols-2 gap-3 bg-[#14161a] p-4 rounded-xl border border-gray-800/60 text-xs">
                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                            <input type="checkbox" required name="qc_power"
                                class="rounded bg-transparent border-gray-800 accent-purple-500">
                            Tes Hidup / Mati Daya
                        </label>
                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                            <input type="checkbox" required name="qc_display"
                                class="rounded bg-transparent border-gray-800 accent-purple-500">
                            Tes Fungsi Layar Display
                        </label>
                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                            <input type="checkbox" required name="qc_suhu"
                                class="rounded bg-transparent border-gray-800 accent-purple-500">
                            Tes Suhu Kerja Alat
                        </label>
                        <label class="flex items-center gap-2 text-gray-300 cursor-pointer">
                            <input type="checkbox" required name="qc_baterai"
                                class="rounded bg-transparent border-gray-800 accent-purple-500">
                            Tes Pengisian Baterai
                        </label>
                    </div>
                    <input type="hidden" name="kondisi" value="B">
                    <input type="hidden" name="status"  value="siap diambil">
                </div>
            `;
            footer.innerHTML = `
                <button type="submit"
                    class="bg-purple-500 hover:bg-purple-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition">
                    Lulus QC dan Siap Diambil
                </button>
            `;
            break;

        // ────── SIAP DIAMBIL & SELESAI ──────
        case 'siap diambil':
        case 'selesai':
            container.innerHTML = `
                <div class="p-4 bg-gray-900/50 border border-gray-800 rounded-xl text-xs text-gray-500 space-y-2 leading-relaxed">
                    <p>Perangkat ini sudah selesai dari sisi teknis dan diserahkan ke meja administrasi kasir.</p>
                    <p class="text-[11px]">Riwayat transaksi, data sparepart terpakai, dan nota pembayaran dikelola oleh Admin Kasir.</p>
                </div>
            `;
            footer.innerHTML = `
                <button type="button" onclick="closeModal()"
                    class="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-xs transition">
                    Tutup
                </button>
            `;
            break;
    }
}

// ── Variabel global untuk menyimpan daftar sparepart ──
let sparepartData = [];

// ── Override fetchSpareparts untuk menyimpan data ──
const originalFetch = fetchSpareparts;
fetchSpareparts = function() {
    const API_URL = "{{ route('teknisi.api.spareparts') }}";
    fetch(API_URL, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
        }
    })
    .then(res => res.json())
    .then(data => {
        sparepartData = data; // simpan global
        // Inisialisasi semua dropdown yang sudah ada
        document.querySelectorAll('.sparepart-select').forEach(select => {
            populateSelect(select);
        });
    })
    .catch(err => console.error('Gagal load sparepart:', err));
};

// ── Populate dropdown dengan data sparepart ──
function populateSelect(select) {
    // Bersihkan option bawaan
    select.innerHTML = '';

    // Tambahkan option placeholder dengan style gelap
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Pilih Komponen --';
    defaultOpt.style.backgroundColor = '#0b0c0f';
    defaultOpt.style.color = '#9ca3af';
    select.appendChild(defaultOpt);

    // Loop sparepartData
    sparepartData.forEach(part => {
        const opt = document.createElement('option');
        opt.value = part.id;
        opt.textContent = part.label + (part.tersedia ? ` (Stok: ${part.stok})` : ' — HABIS');
        // Terapkan style gelap
        opt.style.backgroundColor = '#0b0c0f';
        opt.style.color = '#e5e7eb';
        opt.dataset.harga = part.harga;
        opt.dataset.stok  = part.stok;
        opt.dataset.label = part.label;

        if (!part.tersedia) {
            opt.disabled = true;
            opt.style.color = '#6b7280';
            opt.style.backgroundColor = '#1f2937';
        }
        select.appendChild(opt);
    });
}

// ── Tambah baris sparepart ──
function tambahBarisSparepart() {
    const container = document.getElementById('sparepart-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 bg-[#0b0c0f] border border-gray-800 rounded-lg p-2.5 sparepart-row';

    // Dropdown
    const select = document.createElement('select');
    select.name = 'id_komponen[]';
    select.className = 'sparepart-select flex-1 bg-transparent border-none text-xs text-white focus:outline-none';
    select.onchange = function() { onSparepartChangeRow(this); };
    // Isi option dengan sparepartData jika sudah ada
    if (sparepartData.length > 0) {
        populateSelect(select);
    } else {
        // Jika data belum dimuat, tampilkan loading sementara
        select.innerHTML = `<option value="">Memuat...</option>`;
    }

    // Input jumlah
    const inputJumlah = document.createElement('input');
    inputJumlah.type = 'number';
    inputJumlah.name = 'jumlah_part[]';
    inputJumlah.value = '1';
    inputJumlah.min = '1';
    inputJumlah.className = 'w-16 bg-transparent border border-gray-700 rounded-lg p-1.5 text-center text-xs text-white';

    // Info stok/harga (ringkas) - bisa ditampilkan di bawah row, tapi kita sederhanakan
    // Kita tampilkan info di bawah row dengan ID dinamis
    const infoDiv = document.createElement('div');
    infoDiv.className = 'text-[9px] text-gray-500 mt-0.5 col-span-full';
    infoDiv.id = `info-${Date.now()}`;

    // Tombol hapus
    const btnHapus = document.createElement('button');
    btnHapus.type = 'button';
    btnHapus.className = 'text-red-400 hover:text-red-300 text-xs shrink-0';
    btnHapus.innerHTML = '✕';
    btnHapus.onclick = function() {
        if (document.querySelectorAll('.sparepart-row').length > 1) {
            row.remove();
        } else {
            alert('Minimal satu baris komponen.');
        }
    };

    // Susun row: select, input, hapus
    row.appendChild(select);
    row.appendChild(inputJumlah);
    row.appendChild(btnHapus);

    container.appendChild(row);

    // Jika data sparepart sudah ada, populate select (jika belum)
    if (sparepartData.length > 0 && select.options.length <= 1) {
        populateSelect(select);
    }
}

// ── Saat sparepart dipilih di baris tertentu ──
function onSparepartChangeRow(select) {
    const row = select.closest('.sparepart-row');
    if (!row) return;

    const selectedOption = select.options[select.selectedIndex];
    if (!select.value) {
        // sembunyikan info jika tidak ada pilihan
        const info = row.querySelector('.sparepart-info');
        if (info) info.remove();
        return;
    }

    // Tampilkan info stok/harga di bawah row
    let info = row.querySelector('.sparepart-info');
    if (!info) {
        info = document.createElement('div');
        info.className = 'sparepart-info text-[9px] text-gray-400 mt-1 flex gap-3';
        row.appendChild(info);
    }
    const harga = parseInt(selectedOption.dataset.harga) || 0;
    const stok  = parseInt(selectedOption.dataset.stok)  || 0;
    info.innerHTML = `
        <span>Stok: <strong class="text-white">${stok}</strong> unit</span>
        <span>Harga: <strong class="text-blue-400">Rp ${harga.toLocaleString('id-ID')}</strong></span>
    `;
}

// ── Build Footer Button sesuai kondisi yang dipilih ───────────────────
function buildFooterButton(kondisi, locked) {
    if (locked) return `
        <span class="text-xs text-orange-400/60 italic">Form terkunci saat menunggu respons pelanggan.</span>
    `;

    const buttons = {
        'A': `<button type="submit" class="bg-orange-500 hover:bg-orange-600 text-black font-bold px-5 py-2 rounded-xl text-xs transition">
                Kirim Quotation via WA
            </button>`,
        'B': `<button type="submit" class="bg-blue-500 hover:bg-blue-600 text-white font-bold px-5 py-2 rounded-xl text-xs transition">
                Mulai Pengerjaan
            </button>`,
        'C': `<button type="submit" class="bg-sky-600 hover:bg-sky-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition">
                Laporkan Part Kosong ke Admin
            </button>`,
        'D': `<button type="submit" class="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition">
                Tandai Tidak Bisa Diperbaiki
            </button>`,
    };
    return buttons[kondisi] || '';
}

// ── Saat radio kondisi berubah ────────────────────────────────────────
function onKondisiChange(kondisi) {
    const panelA  = document.getElementById('panelKondisiA');
    const panelD  = document.getElementById('panelKondisiD');
    const hidden  = document.getElementById('inputKondisiHidden');
    const footer  = document.getElementById('modalFooterButtons');

    panelA.classList.toggle('hidden', kondisi !== 'A');
    panelD.classList.toggle('hidden', kondisi !== 'D');

    if (hidden) hidden.value = kondisi;
    footer.innerHTML = buildFooterButton(kondisi, false);
}

// ── Auto-hitung total estimasi Kondisi A ─────────────────────────────
function hitungTotal() {
    const part  = parseInt(document.getElementById('hargaPart')?.value)  || 0;
    const jasa  = parseInt(document.getElementById('biayaJasa')?.value)  || 0;
    const total = document.getElementById('totalEstimasi');
    if (total) total.value = part + jasa;
}

// ── Tutup modal ───────────────────────────────────────────────────────
function closeModal() {
    document.getElementById('ticketDetailModal').classList.add('hidden');
}

function handleBackdropClick(e) {
    if (e.target === document.getElementById('ticketDetailModal')) closeModal();
}

// ── Fetch daftar sparepart dari API ──────────────────────────────────
function fetchSpareparts() {
    const API_URL = "{{ route('teknisi.api.spareparts') }}";

    fetch(API_URL, {
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json',
        }
    })
    .then(res => {
        if (!res.ok) throw new Error('Gagal memuat data komponen.');
        return res.json();
    })
    .then(data => {
        const loading = document.getElementById('sparepartLoadingState');
        const select  = document.getElementById('selectSparepart');
        if (!loading || !select) return;

        // Sembunyikan loading, tampilkan select
        loading.classList.add('hidden');
        select.classList.remove('hidden');

        // Isi option dari data API
        data.forEach(part => {
            const option = document.createElement('option');
            option.value        = part.id;
            option.textContent  = part.label + (part.tersedia ? ` (Stok: ${part.stok})` : ' — HABIS');
            option.dataset.harga  = part.harga;
            option.dataset.stok   = part.stok;
            option.dataset.label  = part.label;
            option.disabled       = !part.tersedia; // nonaktifkan yang habis
            select.appendChild(option);
        });
    })
    .catch(err => {
        const loading = document.getElementById('sparepartLoadingState');
        if (loading) {
            loading.innerHTML = `
                <span class="text-red-400 text-xs">Gagal memuat komponen. Coba refresh halaman.</span>
            `;
        }
        console.error(err);
    });
}

// ── Saat sparepart dipilih dari dropdown ─────────────────────────────
function onSparepartChange(select) {
    const selectedOption = select.options[select.selectedIndex];
    const infoBox        = document.getElementById('sparepartInfo');
    const infoStok       = document.getElementById('infoStok');
    const infoHarga      = document.getElementById('infoHarga');
    const inputHarga     = document.getElementById('inputHargaPart');
    const inputNama      = document.getElementById('inputNamaPart');
    const displayTotal   = document.getElementById('displayTotal');
    const inputTotal     = document.getElementById('inputTotalEstimasi');

    if (!select.value) {
        infoBox.classList.add('hidden');
        inputHarga.value  = 0;
        inputNama.value   = '';
        displayTotal.textContent = 'Rp 0';
        inputTotal.value  = 0;
        return;
    }

    const harga = parseInt(selectedOption.dataset.harga) || 0;
    const stok  = parseInt(selectedOption.dataset.stok)  || 0;
    const nama  = selectedOption.dataset.label || '';
    const total = harga + 50000; // harga komponen + biaya jasa tetap

    // Tampilkan info box
    infoBox.classList.remove('hidden');
    infoStok.textContent  = stok + ' unit';
    infoHarga.textContent = 'Rp ' + harga.toLocaleString('id-ID');

    // Isi hidden input
    inputHarga.value = harga;
    inputNama.value  = nama;

    // Update total
    displayTotal.textContent = 'Rp ' + total.toLocaleString('id-ID');
    inputTotal.value = total;
}

// ── Saat radio kondisi berubah ────────────────────────────────────────
function onKondisiChange(kondisi) {
    const panelA  = document.getElementById('panelKondisiA');
    const panelC  = document.getElementById('panelKondisiC');
    const panelD  = document.getElementById('panelKondisiD');
    const hidden  = document.getElementById('inputKondisiHidden');
    const footer  = document.getElementById('modalFooterButtons');

    // Sembunyikan semua panel dulu
    panelA?.classList.add('hidden');
    panelC?.classList.add('hidden');
    panelD?.classList.add('hidden');

    // Tampilkan panel yang sesuai
    if (kondisi === 'A') panelA?.classList.remove('hidden');
    if (kondisi === 'C') panelC?.classList.remove('hidden');
    if (kondisi === 'D') panelD?.classList.remove('hidden');

    if (hidden) hidden.value = kondisi;
    footer.innerHTML = buildFooterButton(kondisi, false);
}
</script>

@endsection