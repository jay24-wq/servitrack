@extends('layouts.teknisi')

@section('title', 'Dashboard Teknisi - ServiTrack')

@section('content')
<div class="max-w-4xl mx-auto px-8 py-8 space-y-6">
    <div>
        <h1 class="text-3xl font-bold text-white">Halo, {{ auth()->user()->name }}!</h1>
        <p class="text-gray-400 mt-1">Berikut ringkasan tugasmu hari ini.</p>
    </div>

    <div class="grid grid-cols-3 gap-4">
        @foreach([
            ['label' => 'Tiket Aktif',   'value' => $stats['aktif'],   'color' => 'blue'],
            ['label' => 'Selesai',        'value' => $stats['selesai'], 'color' => 'emerald'],
            ['label' => 'Menunggu Part',  'value' => $stats['urgent'],  'color' => 'orange'],
        ] as $s)
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ $s['label'] }}</p>
            <p class="text-4xl font-bold text-white mt-2">{{ $s['value'] }}</p>
        </div>
        @endforeach
    </div>

    <a href="{{ route('teknisi.my-tasks') }}"
       class="block w-full py-3 bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white font-semibold rounded-xl text-sm text-center transition">
        Lihat Semua Tugas → My Tasks
    </a>
</div>
@endsection