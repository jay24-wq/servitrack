@extends('layouts.teknisi')

@section('content')
<div class="max-w-[1400px] mx-auto space-y-8 px-10 py-8">

    {{-- PAGE HEADER --}}
    <div class="flex justify-between items-start">
        <div>
            <h1 class="text-4xl font-bold text-white tracking-tight">Stok Komponen</h1>
            <p class="text-gray-400 mt-1">Referensi ketersediaan gudang real-time</p>
        </div>
        <div class="flex gap-3">
            <div class="bg-[#14161a] border border-gray-800 rounded-xl px-5 py-3 text-center min-w-[120px]">
                <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Items</p>
                <p class="text-3xl font-bold text-white tracking-tight">
                    {{ number_format(\App\Models\Sparepart::sum('sparepart_stock')) }}
                </p>
            </div>

            @php
                $jumlahKritis = \App\Models\Sparepart::whereRaw('sparepart_stock <= stok_minimum')->where('sparepart_stock', '>', 0)->count();
            @endphp

            <div class="bg-[#14161a] border {{ $jumlahKritis > 0 ? 'border-red-900/50' : 'border-gray-800' }} rounded-xl px-5 py-3 text-center min-w-[120px]">
                <p class="text-[10px] font-bold uppercase tracking-widest {{ $jumlahKritis > 0 ? 'text-red-400' : 'text-gray-500' }} mb-1">Low Stock</p>
                <p class="text-3xl font-bold {{ $jumlahKritis > 0 ? 'text-red-500' : 'text-white' }} tracking-tight">
                    {{ $jumlahKritis }}
                </p>
            </div>
        </div>
    </div>

    {{-- FILTER TOOLBAR --}}
    <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">

        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800/60">
            <form action="{{ route('teknisi.stok.index') }}" method="GET" class="flex gap-3 items-center" id="form-filter">

                {{-- Filter Kategori --}}
                <div class="relative flex items-center">
                    <span class="absolute left-3 text-gray-500 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                        </svg>
                    </span>
                    <select name="merek" onchange="this.form.submit()"
                        class="bg-gray-900/60 border border-gray-700 pl-8 pr-8 py-1.5 text-xs font-mono font-semibold text-gray-300 hover:text-white focus:outline-none cursor-pointer transition-colors rounded-lg appearance-none leading-none">
                        <option value="">Kategori: Semua</option>
                        @foreach($daftarMerek as $merek)
                        <option value="{{ $merek }}" {{ request('merek') == $merek ? 'selected' : '' }}>
                            Kategori: {{ $merek }}
                        </option>
                        @endforeach
                    </select>
                    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                @if(request('search') || request('merek'))
                <a href="{{ route('teknisi.stok.index') }}" class="text-xs text-gray-500 hover:text-red-400 transition-colors">
                    Clear Filter
                </a>
                @endif
            </form>

            {{-- Keterangan Jumlah --}}
            <p class="font-mono text-xs text-gray-500">
                Menampilkan {{ $spareparts->count() }} dari {{ $spareparts->total() }} komponen
            </p>
        </div>

        {{-- TABLE --}}
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                    <th class="px-6 py-3.5">ID Komponen</th>
                    <th class="px-6 py-3.5">Nama Barang</th>
                    <th class="px-6 py-3.5">Kategori</th>
                    <th class="px-6 py-3.5">Sisa Stok</th>
                    <th class="px-6 py-3.5 text-right">Badge Status</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/50">
                @forelse($spareparts as $part)

                @php
                    $isKritis = $part->sparepart_stock > 0 && $part->sparepart_stock <= $part->stok_minimum;
                    $isHabis  = $part->sparepart_stock === 0;
                @endphp

                <tr class="hover:bg-gray-900/20 transition-colors duration-150">
                    {{-- ID Komponen --}}
                    <td class="px-6 py-4 font-mono text-xs text-gray-500 tracking-wider">
                        ST-{{ str_pad($part->id, 4, '0', STR_PAD_LEFT) }}
                    </td>

                    {{-- Nama Barang --}}
                    <td class="px-6 py-4 font-semibold text-white text-sm">
                        {{ $part->nama }}
                    </td>

                    {{-- Kategori Badge --}}
                    <td class="px-6 py-4">
                        <span class="bg-gray-800 text-gray-400 font-mono text-[10px] font-bold tracking-wider px-2.5 py-1 rounded">
                            {{ strtoupper($part->merek ?? 'GENERIC') }}
                        </span>
                    </td>

                    {{-- Sisa Stok --}}
                    <td class="px-6 py-4">
                        @if($isHabis)
                            <span class="text-gray-500 font-bold text-sm">0</span>
                        @elseif($isKritis)
                            <span class="text-red-400 font-bold text-sm">{{ $part->sparepart_stock }}</span>
                        @else
                            <span class="text-white font-semibold text-sm">{{ $part->sparepart_stock }}</span>
                        @endif
                    </td>

                    {{-- Badge Status --}}
                    <td class="px-6 py-4 text-right">
                        @if($isHabis)
                            <span class="inline-flex items-center gap-1.5 bg-gray-800/50 text-gray-400 border border-gray-700/50 text-[11px] font-bold px-3 py-1.5 rounded-full">
                                <span class="w-1.5 h-1.5 rounded-full bg-gray-500 block"></span>
                                HABIS
                            </span>
                        @elseif($isKritis)
                            <span class="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-bold px-3 py-1.5 rounded-full">
                                <span class="w-1.5 h-1.5 rounded-full bg-red-500 block"></span>
                                KRITIS
                            </span>
                        @else
                            <span class="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-3 py-1.5 rounded-full">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 block"></span>
                                TERSEDIA
                            </span>
                        @endif
                    </td>
                </tr>

                @empty
                <tr>
                    <td colspan="5" class="text-center px-6 py-12 text-gray-600 text-sm">
                        Belum ada data komponen.
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>

        {{-- PAGINATION --}}
        <div class="flex items-center justify-between px-6 py-3.5 border-t border-gray-800/60">
            <a href="{{ $spareparts->previousPageUrl() ?? '#' }}"
                class="text-xs {{ $spareparts->onFirstPage() ? 'text-gray-700 pointer-events-none' : 'text-gray-500 hover:text-white' }} transition-colors flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Prev
            </a>

            <div class="flex items-center gap-1">
                @foreach($spareparts->getUrlRange(1, $spareparts->lastPage()) as $pageNum => $url)
                <a href="{{ $url }}"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors
                    {{ $spareparts->currentPage() == $pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-white hover:bg-gray-800' }}">
                    {{ $pageNum }}
                </a>
                @endforeach
            </div>

            <a href="{{ $spareparts->nextPageUrl() ?? '#' }}"
                class="text-xs {{ $spareparts->hasMorePages() ? 'text-gray-500 hover:text-white' : 'text-gray-700 pointer-events-none' }} transition-colors flex items-center gap-1.5">
                Next
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </a>
        </div>
    </div>

</div>
@endsection