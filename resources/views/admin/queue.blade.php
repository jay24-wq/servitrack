@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- ================================================================
        STAT CARDS
    ================================================================ --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {{-- Sedang Dikerjakan --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5 relative overflow-hidden">
            <div class="relative z-10">
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Sedang Dikerjakan</p>
                <p class="text-4xl font-bold text-white mt-2">{{ $stats['pengerjaan'] }}</p>
                <p class="text-[10px] font-bold uppercase tracking-wider 
                    {{ $stats['pengerjaan_growth'] >= 0 ? 'text-blue-400' : 'text-red-400' }} mt-2">
                    {{ $stats['pengerjaan_growth'] >= 0 ? '+' : '' }}{{ $stats['pengerjaan_growth'] }} From Yesterday
                </p>
            </div>
            <div class="absolute -right-4 -bottom-4 opacity-5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-28 w-28 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </div>
        </div>

        {{-- Menunggu Antrian --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5 relative overflow-hidden">
            <div class="relative z-10">
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Menunggu Antrean</p>
                <p class="text-4xl font-bold text-amber-400 mt-2">{{ $stats['antrian'] }}</p>
                <p class="text-[10px] font-bold uppercase tracking-wider text-red-400 mt-2">
                    Urgent: {{ $stats['urgent'] }} Tickets
                </p>
            </div>
            <div class="absolute -right-4 -bottom-4 opacity-5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-28 w-28 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
        </div>

        {{-- Efficiency Rate --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Efficiency Rate</p>
            <p class="text-4xl font-bold text-white mt-2">{{ $stats['efficiency_rate'] }}%</p>
            <div class="mt-3 w-full bg-gray-800 rounded-full h-1">
                <div class="bg-blue-500 h-1 rounded-full" style="width: {{ $stats['efficiency_rate'] }}%"></div>
            </div>
        </div>

        {{-- Completed Today --}}
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">Completed Today</p>
            <div class="flex items-center gap-3 mt-2">
                <p class="text-4xl font-bold text-white">{{ $stats['selesai_hari_ini'] }}</p>
                <div class="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
            </div>
        </div>
    </div>

    {{-- ================================================================
        TABLE HEADER
    ================================================================ --}}
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 class="text-4xl font-bold text-white tracking-tight">Ticket Queue Management</h1>
            <p class="text-gray-400 mt-1">Manage and track active repair requests across all technicians.</p>
        </div>

        <div class="flex items-center gap-3">
            {{-- Filter Status --}}
            <form method="GET" action="{{ route('admin.queue') }}" id="filter-form">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <select name="status" onchange="document.getElementById('filter-form').submit()"
                                class="bg-[#14161a] border border-gray-800 rounded-lg pl-4 pr-8 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer">
                            <option value="">All Status</option>
                            @foreach(['antrian', 'pengecekan', 'menunggu part', 'pengerjaan', 'quality control', 'siap diambil', 'selesai'] as $s)
                            <option value="{{ $s }}" {{ request('status') == $s ? 'selected' : '' }}>
                                {{ ucfirst($s) }}
                            </option>
                            @endforeach
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {{-- Filter Teknisi --}}
                    <div class="relative">
                        <select name="teknisi" onchange="document.getElementById('filter-form').submit()"
                                class="bg-[#14161a] border border-gray-800 rounded-lg pl-4 pr-8 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer">
                            <option value="">All Technicians</option>
                            @foreach($teknisiList as $tek)
                            <option value="{{ $tek->id }}" {{ request('teknisi') == $tek->id ? 'selected' : '' }}>
                                {{ $tek->name }}
                            </option>
                            @endforeach
                        </select>
                        <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {{-- Filter Icon --}}
                    <button type="submit"
                            class="p-2 bg-[#14161a] border border-gray-800 rounded-lg text-gray-500 hover:text-white hover:border-blue-500/50 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    </div>

    {{-- ================================================================
        TABLE
    ================================================================ --}}
    <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-gray-800 text-gray-500 text-xs font-semibold uppercase tracking-wider bg-gray-900/30">
                    <th class="px-6 py-4">Ticket ID</th>
                    <th class="px-6 py-4">Customer</th>
                    <th class="px-6 py-4">Device Model</th>
                    <th class="px-6 py-4">Status</th>
                    <th class="px-6 py-4">Technician</th>
                    <th class="px-6 py-4 text-center">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60 text-sm">
                @forelse($tickets as $ticket)
                <tr class="hover:bg-gray-900/20 transition">

                    {{-- Ticket ID --}}
                    <td class="px-6 py-4">
                        <span class="font-mono text-xs text-blue-400 font-bold">#{{ $ticket->kode_servis }}</span>
                    </td>

                    {{-- Customer --}}
                    <td class="px-6 py-4">
                        <p class="font-semibold text-white">{{ $ticket->nama_pelanggan }}</p>
                        <p class="text-xs text-gray-500 mt-0.5">{{ $ticket->email ?? $ticket->nomor_hp }}</p>
                    </td>

                    {{-- Device Model --}}
                    <td class="px-6 py-4">
                        <p class="text-gray-300">{{ $ticket->device_name }} {{ $ticket->device_brand }}</p>
                        <p class="text-xs text-gray-600 mt-0.5 truncate max-w-[180px]">{{ Str::limit($ticket->keluhan, 30) }}</p>
                    </td>

                    {{-- Status --}}
                    <td class="px-6 py-4">
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
                        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider {{ $cfg['bg'] }} {{ $cfg['text'] }}">
                            <span class="w-1.5 h-1.5 rounded-full {{ $cfg['dot'] }}"></span>
                            {{ $ticket->status }}
                        </span>
                    </td>

                    {{-- Technician --}}
                    <td class="px-6 py-4">
                        @if($ticket->user)
                            <div class="flex items-center gap-2">
                                <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-[9px] font-bold text-white">
                                    {{ strtoupper(substr($ticket->user->name, 0, 2)) }}
                                </div>
                                <span class="text-gray-300 text-xs">{{ $ticket->user->name }}</span>
                            </div>
                        @else
                            <span class="text-gray-600">—</span>
                        @endif
                    </td>

                    {{-- Actions --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-center gap-2">
                            <a href="{{ route('admin.tickets.show', $ticket) }}"
                                class="p-1.5 bg-gray-900 hover:bg-blue-500/10 border border-gray-800 hover:border-blue-500/30 text-gray-500 hover:text-blue-400 rounded-lg transition"
                                title="Lihat Detail">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </a>

                            {{-- Update Status --}}
                            <div class="relative" x-data="{ open: false }">
                                <button @click="open = !open"
                                        class="p-1.5 bg-gray-900 hover:bg-indigo-500/10 border border-gray-800 hover:border-indigo-500/30 text-gray-500 hover:text-indigo-400 rounded-lg transition"
                                        title="Update Status">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>

                                <div x-show="open" @click.outside="open = false"
                                    class="absolute right-0 mt-1 w-44 bg-[#14161a] border border-gray-800 rounded-xl shadow-2xl z-20 overflow-hidden">
                                    @foreach(['antrian', 'pengecekan', 'menunggu part', 'pengerjaan', 'quality control', 'siap diambil', 'selesai'] as $s)
                                    <form method="POST" action="{{ route('admin.tickets.updateStatus', $ticket) }}">
                                        @csrf
                                        @method('PATCH')
                                        <input type="hidden" name="status" value="{{ $s }}">
                                        <button type="submit"
                                                class="w-full text-left px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition
                                                {{ $ticket->status === $s ? 'text-blue-400 bg-blue-500/5' : '' }}">
                                            {{ ucfirst($s) }}
                                        </button>
                                    </form>
                                    @endforeach
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-gray-600">
                        Tidak ada tiket ditemukan
                    </td>
                </tr>
                @endforelse
            </tbody>
        </table>

        {{-- Pagination --}}
        @if($tickets->hasPages())
        <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <p class="text-xs text-gray-500">
                Showing {{ $tickets->firstItem() }}-{{ $tickets->lastItem() }} of {{ $tickets->total() }} tickets
            </p>
            <div class="flex items-center gap-1">
                {{-- Previous --}}
                @if($tickets->onFirstPage())
                    <span class="px-3 py-1.5 text-xs text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">‹</span>
                @else
                    <a href="{{ $tickets->previousPageUrl() }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">‹</a>
                @endif

                {{-- Pages --}}
                @foreach($tickets->getUrlRange(1, $tickets->lastPage()) as $page => $url)
                    @if($page == $tickets->currentPage())
                        <span class="px-3 py-1.5 text-xs font-bold text-white bg-blue-600/20 border border-blue-500/30 rounded-lg">{{ $page }}</span>
                    @else
                        <a href="{{ $url }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">{{ $page }}</a>
                    @endif
                @endforeach

                {{-- Next --}}
                @if($tickets->hasMorePages())
                    <a href="{{ $tickets->nextPageUrl() }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">›</a>
                @else
                    <span class="px-3 py-1.5 text-xs text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">›</span>
                @endif
            </div>
        </div>
        @endif
    </div>

</div>
@endsection