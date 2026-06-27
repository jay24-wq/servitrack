@extends('layouts.teknisi')

@section('title', 'My Tasks - ServiTrack')

@section('content')
{{-- Kanban Board: Full height, horizontal scroll --}}
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
                    $isUrgent  = $status === 'menunggu part';
                    $isPending = $status === 'pengerjaan';
                @endphp

                <div class="bg-[#14161a] border border-gray-800 rounded-xl p-4 space-y-3 hover:border-gray-700 transition group
                            {{ $isUrgent ? 'border-l-2 border-l-orange-500' : '' }}
                            {{ $isPending ? 'border-l-2 border-l-blue-500' : '' }}">

                    {{-- Ticket ID --}}
                    <div class="flex items-center justify-between">
                        <span class="text-[9px] font-mono text-gray-600">#{{ $ticket->kode_servis }}</span>
                        <div class="flex items-center gap-1.5">
                            @if($isUrgent)
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

                    {{-- Action --}}
                    <div class="flex items-center justify-between pt-1 border-t border-gray-800/60">
                        <a href="#"
                            class="text-[9px] font-bold uppercase tracking-wider
                            {{ $isPending ? 'text-blue-400 border border-blue-500/30 bg-blue-500/5' : 'text-gray-500 border border-gray-800 bg-transparent' }}
                            px-3 py-1.5 rounded-lg hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/5 transition">
                            Buka Detail
                        </a>

                        {{-- Quick Status Update --}}
                        @if($status !== 'selesai')
                        <div class="relative group/menu">
                            <button class="p-1.5 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                                </svg>
                            </button>
                            <div class="hidden group-hover/menu:block absolute right-0 bottom-8 w-40 bg-[#14161a] border border-gray-800 rounded-xl shadow-2xl z-20 overflow-hidden">
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
                                    <button type="submit"
                                            class="w-full text-left px-3 py-2 text-[10px] text-gray-400 hover:text-white hover:bg-gray-800 transition capitalize">
                                        → {{ ucfirst($nextStatus) }}
                                    </button>
                                </form>
                                @endforeach
                            </div>
                        </div>
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
@endsection