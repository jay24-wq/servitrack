@extends('layouts.app')

@section('title', 'Device Intake - ServiTrack')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6 pb-24">

    {{-- Page Header --}}
    <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Device Intake</h1>
        <p class="text-gray-400 mt-1">Daftarkan perangkat masuk dan dokumentasikan kondisi awalnya.</p>
    </div>

    @if(session('success'))
    <div id="toast-notification" class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm font-semibold transition-opacity duration-500 opacity-100">
        {{ session('success') }}
    </div>
    <script>
        setTimeout(function() {
            const toast = document.getElementById('toast-notification');
            if (toast) {
                toast.classList.remove('opacity-100');
                toast.classList.add('opacity-0');
                setTimeout(() => toast.remove(), 500);
            }
        }, 3000);
    </script>
    @endif

    <form method="POST" action="{{ route('admin.tickets.store') }}"
        enctype="multipart/form-data" id="intake-form" class="space-y-6">
        @csrf

        {{-- ================================================================
            SECTION 1 — Data Pelanggan
        ================================================================ --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">

            <div class="flex items-center space-x-2 border-b border-gray-800 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="text-white font-semibold text-xs uppercase tracking-wider">Data Pelanggan</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Nama Lengkap <span class="text-red-400">*</span>
                    </label>
                    <input type="text" name="customer_name" required maxlength="50"
                        placeholder="e.g. Richardo Raphael"
                        value="{{ old('customer_name') }}"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                    @error('customer_name')
                        <p class="text-red-400 text-[10px] mt-1">{{ $message }}</p>
                    @enderror
                </div>
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Nomor HP <span class="text-red-400">*</span>
                    </label>
                    <input type="tel" name="phone_number" required maxlength="15"
                        placeholder="+62 812 0000 0000"
                        value="{{ old('phone_number') }}"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                    @error('phone_number')
                        <p class="text-red-400 text-[10px] mt-1">{{ $message }}</p>
                    @enderror
                </div>
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Email <span class="text-gray-600 normal-case font-normal">(opsional)</span>
                </label>
                <input type="email" name="email" maxlength="100"
                    placeholder="pelanggan@email.com"
                    value="{{ old('email') }}"
                    class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
            </div>
        </div>

        {{-- ================================================================
            SECTION 2 — Data Perangkat
        ================================================================ --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">

            <div class="flex items-center space-x-2 border-b border-gray-800 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-white font-semibold text-xs uppercase tracking-wider">Data Perangkat</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Tanggal Check-in <span class="text-red-400">*</span>
                    </label>
                    <input type="date" name="checkin_date" required
                        value="{{ old('checkin_date', date('Y-m-d')) }}"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition">
                </div>
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        No. Resi
                    </label>
                    <input type="text" disabled
                        value="Auto-generate saat disimpan"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-600 opacity-50 cursor-not-allowed">
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Nama Perangkat <span class="text-red-400">*</span>
                    </label>
                    <input type="text" name="device_name" required maxlength="100"
                        placeholder="e.g. Laptop, Smartphone, Tablet"
                        value="{{ old('device_name') }}"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                    @error('device_name')
                        <p class="text-red-400 text-[10px] mt-1">{{ $message }}</p>
                    @enderror
                </div>
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Merek
                    </label>
                    <input type="text" name="device_brand" maxlength="50"
                        placeholder="e.g. ASUS, Apple, Samsung"
                        value="{{ old('device_brand') }}"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                </div>
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Serial / Model <span class="text-red-400">*</span>
                </label>
                <input type="text" name="device_serial" required maxlength="50"
                    placeholder="e.g. 13 Pro Max, GL553VD"
                    value="{{ old('device_serial') }}"
                    id="field-serial"
                    class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
                @error('device_serial')
                    <p class="text-red-400 text-[10px] mt-1">{{ $message }}</p>
                @enderror
            </div>

            <div class="space-y-1.5">
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Kondisi Fisik Perangkat
                </label>
                <input type="text" name="device_condition" maxlength="255"
                    placeholder="e.g. Lecet halus di sudut kiri, layar retak bagian bawah..."
                    value="{{ old('device_condition') }}"
                    class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition">
            </div>
        </div>

        {{-- ================================================================
            SECTION 3 — Foto Dokumentasi
        ================================================================ --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">

            <div class="flex items-center space-x-2 border-b border-gray-800 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span class="text-white font-semibold text-xs uppercase tracking-wider">Foto Dokumentasi</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                @foreach([
                    ['icon' => 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z', 'label' => 'Tampak Depan'],
                ] as $slot)
                <label class="border border-dashed border-gray-800 bg-gray-900/50 rounded-xl aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition group">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 group-hover:text-blue-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="{{ $slot['icon'] }}" />
                    </svg>
                    <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-400 transition">{{ $slot['label'] }}</span>
                    <input type="file" name="foto[]" accept="image/*" class="hidden">
                </label>
                @endforeach
            </div>

            <input type="hidden" name="foto_keterangan[]" value="Device">
        </div>

        {{-- ================================================================
            SECTION 4 — Keluhan Pelanggan
        ================================================================ --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">

            <div class="flex items-center space-x-2 border-b border-gray-800 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span class="text-white font-semibold text-xs uppercase tracking-wider">Keluhan Pelanggan</span>
            </div>

            <textarea name="keluhan" rows="4"
                    placeholder="Deskripsikan gejala kerusakan secara detail... (e.g. Perangkat restart sendiri setiap 15 menit, port charging longgar, pelanggan melaporkan terkena air 2 hari lalu)."
                    class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition resize-none">{{ old('keluhan') }}</textarea>
        </div>

    </form>
</div>

{{-- Fixed Footer --}}
<div class="fixed bottom-0 left-64 right-0 bg-[#0b0c0f]/95 border-t border-gray-800 px-10 py-4 flex items-center justify-between backdrop-blur-md z-30">
    <div class="flex items-center space-x-2 text-[10px] tracking-wider uppercase font-bold text-red-400"
        id="footer-error" style="display:none">
        <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
        <span>Serial / Model wajib diisi</span>
    </div>
    <div id="footer-ok"></div>

    <div class="flex items-center space-x-3">
        <button type="button"
                onclick="document.getElementById('intake-form').reset()"
                class="px-5 py-2 bg-[#14161a] hover:bg-gray-800 border border-gray-800 text-gray-300 rounded-lg text-xs font-semibold tracking-wide transition">
            Discard
        </button>
        <button type="submit" form="intake-form" id="submit-btn"
            class="bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2">
            <i class="fa-solid fa-print text-blue-400"></i>
            Simpan & Cetak Tanda Terima
        </button>
    </div>
</div>
@endsection

@push('scripts')
<script>
    const serialInput = document.getElementById('field-serial');
    const footerError = document.getElementById('footer-error');
    const submitBtn   = document.getElementById('submit-btn');

    function cekSerial() {
        if (serialInput.value.trim() === '') {
            footerError.style.display = 'flex';
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            footerError.style.display = 'none';
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    serialInput.addEventListener('input', cekSerial);
    cekSerial();
</script>
@endpush