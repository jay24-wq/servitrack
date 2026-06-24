@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto space-y-8 px-10 py-8">

    <div>
        <h1 class="text-4xl font-bold text-white tracking-tight">Management Inventaris</h1>
        <p class="text-gray-400 mt-1">Monitor and manage your parts inventory efficiently.</p>
    </div>

    @if(session('success'))
    <div id="toast-notification" class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm font-semibold transition-opacity duration-500 opacity-100">
        {{ session('success') }}
    </div>

    <script>
        // Tunggu 3 detik (3000ms), lalu jalankan efek memudar
        setTimeout(function() {
            const toast = document.getElementById('toast-notification');
            if (toast) {
                toast.classList.remove('opacity-100');
                toast.classList.add('opacity-0'); // Membuatnya transparan secara halus

                // Tunggu 500ms lagi sampai animasi selesai, baru hapus elemennya dari layar
                setTimeout(() => toast.remove(), 500);
            }
        }, 3000);
    </script>
    @endif

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 flex justify-between items-start">
            <div class="space-y-2">
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Suku Cadang</p>
                <h3 class="text-4xl font-bold text-white tracking-tight">
                    {{ $spareparts->sum('sparepart_stock') }}
                </h3>
            </div>
            <span class="text-gray-400 bg-gray-900/50 p-2 rounded-lg border border-gray-800/80">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
            </span>
        </div>

        @php
        $jumlahKritis = $spareparts->filter(function($part) {
        return $part->sparepart_stock <= $part->stok_minimum;
            })->count();
            @endphp

            @if($jumlahKritis > 0)
            <div class="bg-[#14161a] border border-red-900/50 bg-gradient-to-br from-red-950/20 to-transparent rounded-xl p-6 flex justify-between items-start transition-all duration-300">
                <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-red-400">Stok Menipis</p>
                    <h3 class="text-4xl font-bold text-red-500 tracking-tight">
                        {{ $jumlahKritis }}
                    </h3>
                </div>
                <span class="text-red-500 bg-red-950/30 p-2 rounded-lg border border-red-900/30">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </span>
            </div>
            @else
            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 flex justify-between items-start transition-all duration-300">
                <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Stok Menipis</p>
                    <h3 class="text-4xl font-bold text-white tracking-tight">0</h3>
                </div>
                <span class="text-gray-600 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </span>
            </div>
            @endif

            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 flex justify-between items-start">
                <div class="space-y-2">
                    <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Suku Cadang Digunakan Bulan Ini</p>
                    <h3 class="text-4xl font-bold text-white tracking-tight">
                        {{ $sukuCadangDigunakan }}
                    </h3>
                </div>
                <span class="text-gray-600 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </span>
            </div>
    </div>

    <div class="flex justify-between items-center">
        <form action="{{ route('admin.sparepart.index') }}" method="GET" class="flex gap-4 w-full max-w-md m-0" id="form-filter">

            <div class="relative w-full">
                <input type="text" name="search" value="{{ request('search') }}" placeholder="Cari Suku Cadang..." class="w-full bg-[#14161a] border border-gray-800 rounded-lg px-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 placeholder-gray-600" onkeyup="delaySearch()">
            </div>

            <div class="relative flex items-center min-w-[150px]">
                <select name="merek" onchange="this.form.submit()" class="bg-[#14161a] border border-gray-800 pl-4 pr-10 py-2.5 text-sm text-gray-300 hover:text-white focus:outline-none cursor-pointer transition-colors rounded-lg appearance-none leading-none w-full">
                    <option value="">Kategori</option>
                    @foreach($daftarMerek as $merek)
                    <option value="{{ $merek }}" {{ request('merek') == $merek ? 'selected' : '' }}>
                        {{ $merek }}
                    </option>
                    @endforeach
                </select>

                <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            @if(request('search') || request('merek'))
            <a href="{{ route('spareparts.index') }}" class="text-xs text-gray-500 hover:text-red-400 flex items-center whitespace-nowrap">
                Clear Filter
            </a>
            @endif
        </form>

        <button onclick="openTambahModal()" class="bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Tambah Stok Baru
        </button>
    </div>

    <div id="modal-tambah" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 w-full max-w-xl shadow-2xl mx-4">
            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Masukkan Suku Cadang Baru
            </h2>
            <form action="{{ route('admin.sparepart.store') }}" method="POST" class="space-y-4">
                @csrf
                <div>
                    <label class="block text-xs font-medium text-gray-400 mb-1">Nama Suku Cadang</label>
                    <input type="text" name="nama" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required placeholder="Contoh: LCD iPhone 13 Pro">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-400 mb-1">Merek / Kategori</label>
                    <input type="text" name="merek" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="Contoh: Apple">
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Harga Satuan (Rp)</label>
                        <input type="number" name="harga_satuan" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required placeholder="1500000">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Sisa Stok</label>
                        <input type="number" name="sparepart_stock" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required placeholder="10">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-400 mb-1">Stok Minimum</label>
                        <input type="number" name="stok_minimum" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required value="5">
                    </div>
                </div>
                <div class="flex gap-3 justify-end pt-2">
                    <button type="button" onclick="closeTambahModal()" class="px-4 py-2 text-sm text-gray-400 hover:text-white">Batal</button>
                    <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm">Simpan Data</button>
                </div>
            </form>
        </div>
    </div>

    <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-gray-800 text-gray-500 text-xs font-semibold uppercase bg-gray-900/30">
                    <th class="p-4">ID Part</th>
                    <th class="p-4">Nama Suku Cadang</th>
                    <th class="p-4">Kategori</th>
                    <th class="p-4">Sisa Stok</th>
                    <th class="p-4">Stok Minimum</th>
                    <th class="p-4 text-right">Harga Satuan</th>
                    <th class="p-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60 text-sm">
                @forelse($spareparts as $part)
                <tr class="hover:bg-gray-900/20 transition">
                    <td class="p-4 font-mono text-xs text-gray-500">PRT-00{{ $part->id }}</td>
                    <td class="p-4 font-semibold text-white">{{ $part->nama }}</td>
                    <td class="p-4">
                        <span class="bg-gray-800 text-gray-400 text-[11px] font-bold px-2.5 py-1 rounded">
                            {{ $part->merek ?? 'Generic' }}
                        </span>
                    </td>
                    <td class="p-4">
                        @if($part->sparepart_stock <= $part->stok_minimum)
                            <span class="bg-red-500/10 text-red-500 text-xs px-2.5 py-1 rounded font-bold border border-red-500/20">
                                Stok Menipis : {{ $part->sparepart_stock }}
                            </span>
                            @else
                            <span class="text-gray-300 font-medium">{{ $part->sparepart_stock }}</span>
                            @endif
                    </td>
                    <td class="p-4 text-gray-500">{{ $part->stok_minimum }}</td>
                    <td class="p-4 text-right font-medium text-gray-300">
                        Rp {{ number_format($part->harga_satuan, 0, ',', '.') }}
                    </td>
                    <td class="p-4 text-center">
                        <div class="flex items-center justify-center gap-4">
                            <button onclick="openEditModal('{{ $part->id }}')" class="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded hover:bg-gray-800" title="Edit Data">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>

                            <form action="{{ route('admin.sparepart.destroy', $part->id) }}" method="POST" onsubmit="return confirm('Hapus item ini?')" class="inline m-0">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-gray-800" title="Hapus Data">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </td>
                </tr>

                <div id="modal-edit-{{ $part->id }}" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 w-full max-w-xl shadow-2xl">
                        <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit Suku Cadang
                        </h2>
                        <form action="{{ route('admin.sparepart.update', $part->id) }}" method="POST" class="space-y-4">
                            @csrf
                            @method('PUT')
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1">Nama Suku Cadang</label>
                                <input type="text" name="nama" value="{{ $part->nama }}" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required>
                            </div>
                            <div>
                                <label class="block text-xs font-medium text-gray-400 mb-1">Merek / Kategori</label>
                                <input type="text" name="merek" value="{{ $part->merek }}" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500">
                            </div>
                            <div class="grid grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1">Harga Satuan (Rp)</label>
                                    <input type="number" name="harga_satuan" value="{{ $part->harga_satuan }}" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1">Sisa Stok</label>
                                    <input type="number" name="sparepart_stock" value="{{ $part->sparepart_stock }}" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required>
                                </div>
                                <div>
                                    <label class="block text-xs font-medium text-gray-400 mb-1">Stok Minimum</label>
                                    <input type="number" name="stok_minimum" value="{{ $part->stok_minimum }}" class="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" required>
                                </div>
                            </div>
                            <div class="flex gap-3 justify-end pt-2">
                                <button type="button" onclick="closeEditModal('{{ $part->id }}')" class="px-4 py-2 text-sm text-gray-400 hover:text-white">Batal</button>
                                <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm">Simpan Perubahan</button>
                            </div>
                        </form>
                    </div>
                </div>

                @empty
                <tr>
                    <td colspan="7" class="text-center p-8 text-gray-600">Belum ada pasokan suku cadang.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>

</div>
@endsection

<script>
    // Fungsi Manajemen Modal Tambah
    function openTambahModal() {
        document.getElementById('modal-tambah').classList.remove('hidden');
    }

    function closeTambahModal() {
        document.getElementById('modal-tambah').classList.add('hidden');
    }

    // Fungsi Manajemen Modal Edit
    function openEditModal(id) {
        document.getElementById('modal-edit-' + id).classList.remove('hidden');
    }

    function closeEditModal(id) {
        document.getElementById('modal-edit-' + id).classList.add('hidden');
    }

    // Script agar form otomatis submit sendiri setelah user berhenti mengetik beberapa saat (debounce)
    let timer;

    function delaySearch() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            document.getElementById('form-filter').submit();
        }, 500); // 500 milidetik (0.5 detik) setelah berhenti mengetik
    }
</script>