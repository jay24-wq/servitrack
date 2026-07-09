@extends('layouts.app')

@section('title', 'Device Intake - ServiTrack')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6 pb-24">

    {{-- Page Header --}}
    <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Form Frontdesk</h1>
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

            <!-- Flex Container untuk Tombol & Pratinjau (Scrollable Horizontal) -->
            <div class="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                
                <!-- Tombol Tambah Gambar (Permanen di paling kiri) -->
                <label id="add-photo-btn" class="shrink-0 w-28 h-28 border border-dashed border-gray-800 bg-gray-900/50 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition group">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 group-hover:text-blue-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span class="text-[9px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-blue-400 transition text-center px-2">Tambah Gambar</span>
                    <div id="file-input-container">
                        <input type="file" accept="image/*" class="hidden main-file-input">
                    </div>
                </label>

                <!-- Container untuk Gambar Pratinjau (Prepend secara visual) -->
                <div id="preview-list" class="flex items-center gap-3">
                    <!-- Preview cards akan di-render di sini oleh JavaScript -->
                </div>

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

        {{-- ================================================================
            SECTION 5 — Estimasi Biaya Awal
        ================================================================ --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 space-y-4">

            <div class="flex items-center space-x-2 border-b border-gray-800 pb-3">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-white font-semibold text-xs uppercase tracking-wider">Estimasi Biaya Awal</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                {{-- Dropdown Suku Cadang --}}
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Perkiraan Suku Cadang
                    </label>
                    <select id="sparepart_select" class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition">
                        <option value="" data-harga="0">-- Tidak Ganti Part / Belum Tahu --</option>
                        @foreach($spareparts as $part)
                            {{-- Kita ganti $part->sparepart_name jadi $part->nama --}}
                            {{-- Kita ganti $part->sparepart_price jadi $part->harga_satuan --}}
                            <option value="{{ $part->id }}" data-harga="{{ $part->harga_satuan }}">
                                {{ $part->nama }} (+Rp {{ number_format($part->harga_satuan, 0, ',', '.') }})
                            </option>
                        @endforeach
                    </select>
                </div>

                {{-- Biaya Jasa Flat --}}
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Biaya Jasa Analisis & Perbaikan
                    </label>
                    <input type="number" id="biaya_jasa" value="50000" readonly 
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5 text-sm text-gray-500 opacity-60 cursor-not-allowed outline-none">
                </div>

                {{-- Total Estimasi (Dikirim ke backend) --}}
                <div class="space-y-1.5">
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 text-blue-400">
                        Total Estimasi ke Pelanggan
                    </label>
                    <div class="relative">
                        <span class="absolute left-4 top-2.5 text-sm text-gray-500">Rp</span>
                        <input type="number" name="total_biaya" id="estimasi_biaya" value="50000" readonly
                            class="w-full bg-gray-900/50 border border-blue-500/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-blue-400 font-bold outline-none">
                    </div>
                </div>
            </div>
            
            <p class="text-gray-600 text-[10px]">
                *Catatan: Jika keluhan belum jelas (seperti mati total), biarkan pilihan suku cadang kosong. Pelanggan hanya dikenakan estimasi biaya pemeriksaan dasar sebesar Rp 50.000.
            </p>
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
    // Daftarkan element baru
    const sparepartSelect = document.getElementById('sparepart_select');
    const biayaJasa       = document.getElementById('biaya_jasa');
    const estimasiBiaya   = document.getElementById('estimasi_biaya');

    // Fungsi hitung otomatis
    sparepartSelect.addEventListener('change', function() {
        let hargaPart = parseFloat(this.options[this.selectedIndex].getAttribute('data-harga')) || 0;
        let jasa      = parseFloat(biayaJasa.value) || 0;
    
        // Set hasil penjumlahan ke input estimasi_biaya
        estimasiBiaya.value = hargaPart + jasa;
    });

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

    (function () {
        const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
        const MAX_FILES      = 5;
        const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp'];

        let fileCount = 0; // untuk penomoran

        const fileInputContainer = document.getElementById('file-input-container');
        const previewList        = document.getElementById('preview-list');
        const addPhotoBtn        = document.getElementById('add-photo-btn');
        const errorContainer     = document.getElementById('photo-error-container') || createErrorContainer();
        const errorMessage       = document.getElementById('photo-error-message') || document.createElement('span');

        // Buat elemen error jika belum ada
        function createErrorContainer() {
            const container = document.createElement('div');
            container.id = 'photo-error-container';
            container.className = 'text-red-400 text-xs mt-2 hidden';
            const msg = document.createElement('span');
            msg.id = 'photo-error-message';
            container.appendChild(msg);
            addPhotoBtn.parentNode.insertBefore(container, addPhotoBtn.nextSibling);
            return container;
        }

        // Counter (bisa ditambahkan di dekat tombol)
        const counter = document.createElement('span');
        counter.id = 'photo-counter';
        counter.className = 'text-gray-500 text-[10px] ml-2';
        addPhotoBtn.parentNode.appendChild(counter);

        // Klik tombol tambah
        addPhotoBtn.addEventListener('click', function (e) {
            e.preventDefault(); // mencegah perilaku default label

            // Cek jumlah file saat ini (dari input yang ada di preview)
            const currentCount = document.querySelectorAll('#preview-list .shrink-0').length;
            if (currentCount >= MAX_FILES) {
                showError(`Maksimal ${MAX_FILES} foto.`);
                return;
            }

            // Buat input sementara untuk memilih file
            const tempInput = document.createElement('input');
            tempInput.type = 'file';
            tempInput.accept = 'image/jpeg,image/png,image/webp';
            tempInput.multiple = true; // bisa pilih banyak sekaligus

            tempInput.addEventListener('change', function () {
                const files = Array.from(this.files);
                const errors = [];

                files.forEach(file => {
                    // Cek jumlah setelah penambahan
                    const current = document.querySelectorAll('#preview-list .shrink-0').length;
                    if (current >= MAX_FILES) {
                        errors.push(`Batas ${MAX_FILES} foto tercapai. "${file.name}" tidak ditambahkan.`);
                        return;
                    }

                    if (!ALLOWED_TYPES.includes(file.type)) {
                        errors.push(`"${file.name}" bukan format yang didukung (JPG, PNG, WebP).`);
                        return;
                    }

                    if (file.size > MAX_SIZE_BYTES) {
                        const sizeMB = (file.size / 1024 / 1024).toFixed(2);
                        errors.push(`"${file.name}" ${sizeMB}MB > 2MB.`);
                        return;
                    }

                    // Semua validasi lolos → tambahkan ke preview
                    addFileToPreview(file);
                });

                if (errors.length > 0) {
                    showError(errors.join(' '));
                } else {
                    hideError();
                }

                updateCounter();
            });

            tempInput.click();
        });

        // Fungsi untuk menambahkan satu file ke preview (prepend)
        function addFileToPreview(file) {
            // Baca file untuk preview
            const reader = new FileReader();
            reader.onload = function (event) {
                // Buat card
                const card = document.createElement('div');
                card.className = 'relative shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-gray-800 group';

                // Buat input file tersembunyi untuk dikirim ke server
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.name = 'foto[]';
                hiddenInput.className = 'hidden';
                // Kita perlu menambahkan file ke input ini. Karena input file tidak bisa diassign langsung,
                // kita gunakan DataTransfer untuk membuat FileList
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                hiddenInput.files = dataTransfer.files; // Ini diperbolehkan di browser modern

                const fileSize = formatSize(file.size);
                const index = document.querySelectorAll('#preview-list .shrink-0').length + 1;

                card.innerHTML = `
                    <img src="${event.target.result}" class="w-full h-full object-cover" onerror="alert('Berkas rusak atau bukan gambar asli! Berkas akan dihapus.'); this.closest('.relative').remove(); renumberPreviews(); updateCounter();">
                    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <p class="text-[9px] text-gray-300 truncate">${file.name}</p>
                        <p class="text-[9px] text-gray-400">${fileSize}</p>
                    </div>
                    <button type="button" class="absolute top-1.5 right-1.5 w-5 h-5 bg-red-600/80 hover:bg-red-600 rounded-full flex items-center justify-center transition opacity-0 group-hover:opacity-100 z-10" onclick="removePhoto(this)">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div class="absolute top-1.5 left-1.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                        <span class="text-[9px] font-bold text-white">${index}</span>
                    </div>
                `;

                // Masukkan hidden input ke dalam card (agar ikut terkirim)
                card.appendChild(hiddenInput);

                // Prepend ke preview-list (FIFO)
                previewList.insertBefore(card, previewList.firstChild);

                // Sembunyikan tombol tambah jika sudah penuh
                const currentCount = document.querySelectorAll('#preview-list .shrink-0').length;
                if (currentCount >= MAX_FILES) {
                    addPhotoBtn.classList.add('hidden');
                }

                updateCounter();
            };
            reader.readAsDataURL(file);
        }

        // Fungsi hapus foto (dipanggil dari tombol hapus)
        window.removePhoto = function (btn) {
            const card = btn.closest('.shrink-0');
            if (card) {
                card.remove();
                // Perbaiki penomoran ulang
                renumberPreviews();
                updateCounter();
                // Tampilkan tombol tambah jika jumlah < MAX_FILES
                const currentCount = document.querySelectorAll('#preview-list .shrink-0').length;
                if (currentCount < MAX_FILES) {
                    addPhotoBtn.classList.remove('hidden');
                }
                hideError();
            }
        };

        // Fungsi untuk memperbaiki urutan nomor
        function renumberPreviews() {
            const cards = document.querySelectorAll('#preview-list .shrink-0');
            cards.forEach((card, idx) => {
                const numberSpan = card.querySelector('.absolute.top-1.left-1 span');
                if (numberSpan) {
                    numberSpan.textContent = idx + 1;
                }
            });
        }

        // Update counter
        function updateCounter() {
            const count = document.querySelectorAll('#preview-list .shrink-0').length;
            if (counter) {
                counter.textContent = `${count} / ${MAX_FILES} foto`;
                counter.classList.toggle('text-amber-400', count >= MAX_FILES);
                counter.classList.toggle('text-gray-500', count < MAX_FILES);
            }
        }

        // Format ukuran file
        function formatSize(bytes) {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
            return (bytes / 1024 / 1024).toFixed(2) + ' MB';
        }

        // Tampilkan error
        function showError(msg) {
            if (errorMessage) {
                errorMessage.textContent = msg;
                errorContainer.classList.remove('hidden');
            }
        }

        function hideError() {
            if (errorContainer) {
                errorContainer.classList.add('hidden');
                if (errorMessage) errorMessage.textContent = '';
            }
        }

        // Inisialisasi counter
        updateCounter();
    })();
</script>
@endpush