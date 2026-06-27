<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $ticket->tipe_device }} - Live Tracking ServiTrack</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>

<body class="bg-[#0f1115] text-gray-300 font-sans min-h-screen flex flex-col justify-between">

    <nav class="border-b border-gray-800 bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-50">
        <div class="w-full px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex-shrink-0">
                    <a href="/" class="text-xl font-bold text-white tracking-wider">ServiTrack</a>
                </div>    
                    <div class="hidden md:block ml-10 space-x-8">
                        <a href="{{ route('tracking.index') }}" class="text-gray-400 hover:text-white text-sm font-medium transition">Dashboard</a>
                        <a href="#" class="text-white border-b-2 border-white pb-5 text-sm font-medium">Services</a>
                        <a href="#" class="text-gray-400 hover:text-white text-sm font-medium transition">Support</a>
                        <a href="#" class="text-gray-400 hover:text-white text-sm font-medium transition">About</a>
                    </div>
                <div class="flex items-center space-x-4">
                    <a href="/" class="border border-gray-700 hover:border-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition bg-[#161920]">
                        Track Repair
                    </a>
                    <button class="text-gray-400 hover:text-white transition"><i class="fa-regular fa-bell text-lg"></i></button>
                    <button class="text-gray-400 hover:text-white transition"><i class="fa-regular fa-user text-lg"></i></button>
                </div>
            </div>
        </div>
    </nav>

    <main class="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">

        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
            <div class="space-y-2">
                <div class="flex items-center space-x-3">
                    <span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Live Tracking</span>
                    <span class="text-gray-500 text-sm font-mono">ID: #{{ $ticket->kode_servis }}</span>
                </div>
                <h1 class="text-3xl md:text-4xl font-bold text-white tracking-tight">{{ $ticket->tipe_device }}</h1>
                <p class="text-gray-400 text-sm max-w-2xl leading-relaxed">
                    {{ $ticket->keluhan }}
                </p>
            </div>

            <div class="bg-[#141720] border border-gray-800 rounded-xl p-5 min-w-[280px] lg:self-start">
                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Status Terkini</span>
                <div class="flex items-center space-x-2 mt-1">
                    <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <h2 class="text-xl font-bold text-amber-500 uppercase tracking-wide">{{ $ticket->status }}</h2>
                </div>
                <span class="text-xs text-gray-500 block mt-1">Diperbarui baru-baru ini</span>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

            <div class="lg:col-span-2 bg-[#141720]/60 border border-gray-900/50 rounded-xl p-6 md:p-8">
                <h3 class="text-xl font-bold text-white mb-8 tracking-wide">Repair Workflow</h3>

                <div class="relative border-l border-gray-800 ml-4 space-y-10">
                    @php
                    $statuses = ['antrian', 'pengecekan', 'menunggu part', 'pengerjaan', 'quality control', 'siap diambil', 'selesai'];
                    $currentStep = array_search(strtolower($ticket->status), $statuses);
                    @endphp

                    @foreach($statuses as $index => $step)
                    @php
                    $isPassed = $index < $currentStep;
                        $isCurrent=$index===$currentStep;
                        $isPending=$index> $currentStep;
                        @endphp

                        <div class="relative flex items-start pl-8 group">

                            <div class="absolute -left-[17px] top-0.5 w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-300 z-10
                                {{ $isPassed ? 'bg-blue-600/20 border-blue-500 text-blue-400' : '' }}
                                {{ $isCurrent ? 'bg-amber-500 border-amber-500 text-[#0f1115] shadow-lg shadow-amber-500/20' : '' }}
                                {{ $isPending ? 'bg-[#141720] border-gray-800 text-gray-600' : '' }}">

                                @if($isPassed)
                                <i class="fa-solid fa-check text-xs"></i>
                                @elseif($isCurrent)
                                <i class="fa-solid fa-screwdriver-wrench text-xs"></i>
                                @else
                                <i class="fa-regular fa-circle text-[10px]"></i>
                                @endif
                            </div>

                            <div class="flex-grow flex flex-col sm:flex-row sm:justify-between gap-2 items-start w-full">
                                <div class="space-y-1 w-full max-w-xl">
                                    <h4 class="text-base font-bold tracking-wide transition-colors
                                                {{ $isCurrent ? 'text-white' : ($isPassed ? 'text-gray-300' : 'text-gray-600') }}">
                                        {{ ucfirst($step) }}
                                    </h4>

                                    <p class="text-xs leading-relaxed transition-colors {{ $isCurrent || $isPassed ? 'text-gray-400' : 'text-gray-700' }}">
                                        @if($step == 'antrian') Perangkat diterima dan dicatat ke dalam antrian sistem. @endif
                                        @if($step == 'pengecekan') Diagnosa selesai. Masalah termal dan kelelahan komponen teridentifikasi pada jalur GPU. @endif
                                        @if($step == 'menunggu part') Menunggu alokasi suku cadang dari inventaris utama gudang. @endif
                                        @if($step == 'pengerjaan') Perbaikan aktif sedang berlangsung. Penyolderan mikro pada sirkuit manajemen daya GPU. @endif
                                        @if($step == 'quality control') Pengujian beban dan validasi perangkat lunak. @endif
                                        @if($step == 'siap diambil') Unit siap diserahterimakan kembali kepada pelanggan. @endif
                                        @if($step == 'selesai') Unit telah diambil, garansi diaktifkan secara otomatis. @endif
                                    </p>

                                    @if($step == 'pengerjaan' && isset($ticket->tasks) && count($ticket->tasks) > 0)
                                    <div class="mt-4 p-5 bg-[#11131a] border border-gray-800 rounded-lg space-y-4 w-full">
                                        <span class="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                                            <i class="fa-solid fa-list-check mr-1"></i> Rincian Tindakan :
                                        </span>

                                        <div class="space-y-3">
                                            @foreach($ticket->tasks as $task)
                                            <div class="flex items-center justify-between text-xs pb-2 border-b border-gray-950 last:border-0 last:pb-0">
                                                <span class="text-gray-300 font-medium">{{ $task->nama_tugas }}</span>

                                                <div class="flex items-center space-x-2">
                                                    @if($task->status_tugas == 'belum')
                                                    <span class="w-2 h-2 rounded-full bg-red-500 shadow-md shadow-red-500/50"></span>
                                                    <span class="text-red-400 font-semibold text-[10px] uppercase tracking-wider"></span>
                                                    @elseif($task->status_tugas == 'sedang')
                                                    <span class="w-2 h-2 rounded-full bg-yellow-500 animate-pulse shadow-md shadow-yellow-500/50"></span>
                                                    <span class="text-yellow-400 font-semibold text-[10px] uppercase tracking-wider"></span>
                                                    @elseif($task->status_tugas == 'selesai')
                                                    <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-md shadow-emerald-500/50"></span>
                                                    <span class="text-emerald-400 font-semibold text-[10px] uppercase tracking-wider"></span>
                                                    @endif
                                                </div>
                                            </div>
                                            @endforeach
                                        </div>
                                    </div>
                                    @endif

                                    @if($isCurrent)
                                    <div class="w-full bg-gray-800 h-1.5 rounded-full mt-4 overflow-hidden">
                                        <div class="bg-amber-500 h-full w-2/3 rounded-full animate-pulse"></div>
                                    </div>
                                    @endif
                                </div>

                                <div class="text-xs font-mono whitespace-nowrap pt-0.5 sm:text-right">
                                    @if($isPassed || $isCurrent)
                                    <span class="{{ $isCurrent ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold' : 'text-gray-500' }} px-2 py-1 rounded">
                                        {{ $isCurrent ? 'IN PROGRESS' : $ticket->updated_at->format('d M, H:i A') }}
                                    </span>
                                    @else
                                    <span class="text-gray-700">Pending</span>
                                    @endif
                                </div>
                            </div>

                        </div>
                        @endforeach
                </div>
            </div>

            <div class="space-y-6">

                <div class="bg-[#141720]/60 border border-gray-900/50 rounded-xl p-6">
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-4">Teknisi Yang Ditugaskan</span>
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center text-white font-bold text-lg">
                                <i class="fa-solid fa-user-gear text-gray-500"></i>
                            </div>
                            <div>
                                <h4 class="text-sm font-bold text-white">{{ $ticket->user ? $ticket->user->name : 'Frontdesk Staff' }}</h4>
                                <span class="text-[11px] text-gray-400 block">Hardware Engineer</span>
                                <span class="text-[10px] text-amber-500 font-bold tracking-wider uppercase block mt-0.5">Master Technician</span>
                            </div>
                        </div>
                        <button class="text-gray-400 hover:text-white transition p-2 bg-[#181b26] border border-gray-800 rounded-md">
                            <i class="fa-regular fa-comment-dots text-base"></i>
                        </button>
                    </div>
                </div>

                <div class="bg-[#141720]/60 border border-gray-900/50 rounded-xl p-4 overflow-hidden relative group">
                    <div class="aspect-video w-full bg-gray-950 rounded-lg overflow-hidden relative border border-gray-900">
                        <img src="https://images.unsplash.com/photo-1591405351990-4726e331f141?auto=format&fit=crop&w=400&q=80" alt="Surgical View" class="w-full h-full object-cover opacity-40 group-hover:scale-105 transition duration-500">

                        <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded flex items-center space-x-2 border border-white/10">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                            <span class="text-[10px] uppercase font-bold tracking-widest text-white">Siaran Langsung</span>
                        </div>
                    </div>
                </div>

                <div class="bg-[#141720]/30 border border-gray-900 rounded-xl p-6 space-y-4">
                    <h4 class="text-sm font-bold text-white tracking-wide">PERLU BANTUAN?</h4>
                    <p class="text-xs text-gray-400 leading-relaxed">
                        Punya pertanyaan tentang status perbaikan Anda? Teknisi dukungan kami siap membantu.
                    </p>
                    <a href="https://wa.me/{{ $ticket->nomor_hp }}" target="_blank" class="w-full bg-[#141a29] hover:bg-[#1c243a] border border-gray-800 text-white font-semibold py-2.5 rounded-md text-xs tracking-wider uppercase transition block text-center">
                        <i class="fa-regular fa-envelope mr-2"></i> Contact Support
                    </a>
                </div>

            </div>
        </div>
    </main>

    <footer class="border-t border-gray-900 bg-[#0f1115] py-8 px-4 mt-16">
        <div class="w-full flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500 px-4">
            <div class="text-center md:text-left">
                <p class="text-sm font-semibold text-gray-400">ServiTrack</p>
                <p>© 2026 ServiTrack. Surgical precision in electronics repair.</p>
            </div>
            <div class="flex space-x-6 text-sm">
                <a href="#" class="hover:text-white transition"><i class="fa-solid fa-globe"></i></a>
                <a href="#" class="hover:text-white transition"><i class="fa-solid fa-share-nodes"></i></a>
                <a href="#" class="hover:text-white transition"><i class="fa-regular fa-circle-question"></i></a>
            </div>
        </div>
    </footer>

</body>

</html>