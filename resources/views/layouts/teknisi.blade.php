<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'ServiTrack Teknisi')</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
    </style>
    @stack('styles')
</head>
<body class="bg-[#0b0c0f] text-gray-400 font-sans h-screen flex overflow-hidden">

    {{-- SIDEBAR TEKNISI --}}
    <aside class="w-64 bg-[#0f1115] border-r border-gray-900/50 flex flex-col justify-between h-full shrink-0">
        <div>
            {{-- Brand --}}
            <div class="p-6 border-b border-gray-900/50">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-blue-600/10 rounded-lg text-blue-400">
                        <i class="fa-solid fa-screwdriver-wrench"></i>
                    </div>
                    <div>
                        <h2 class="text-sm font-bold text-white tracking-wide uppercase">Technician Portal</h2>
                        <p class="text-[10px] text-gray-500 tracking-wider font-semibold">
                            {{ auth()->user()->name }}
                        </p>
                    </div>
                </div>
            </div>

            {{-- Nav --}}
            <nav class="p-4 space-y-1.5">
                <a href="{{ route('teknisi.dashboard') }}"
                    class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                    {{ request()->routeIs('teknisi.dashboard') ? 'bg-blue-600/10 text-white border-l-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50' }}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Dashboard</span>
                </a>

                <a href="{{ route('teknisi.my-tasks') }}"
                    class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                    {{ request()->routeIs('teknisi.my-tasks') ? 'bg-blue-600/10 text-white border-l-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50' }}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>My Tasks</span>
                </a>

                <a href="{{ route('teknisi.stok.index') }}"
                    class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                    {{ request()->routeIs('teknisi.stok.index') ? 'bg-blue-600/10 text-white border-l-2 border-blue-500' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50' }}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span>Component Stock</span>
                </a>
            </nav>
        </div>

        {{-- Bottom --}}
        <div class="p-4 space-y-3 border-t border-gray-900/50">
            {{-- Shift Status --}}
            <div class="bg-gray-900/60 border border-gray-800 rounded-lg p-3 space-y-1">
                <p class="text-[9px] font-bold uppercase tracking-widest text-gray-600">Shift Status</p>
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="text-xs font-semibold text-white">On Duty</span>
                </div>
            </div>

            <a href="#" class="flex items-center space-x-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
            </a>

            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit" class="w-full flex items-center space-x-2 px-3 py-2 text-xs text-gray-500 hover:text-red-400 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Logout</span>
                </button>
            </form>
        </div>
    </aside>

    {{-- MAIN AREA --}}
    <div class="flex-1 flex flex-col h-full overflow-hidden">

        {{-- Header --}}
        <header class="h-14 border-b border-gray-900/50 px-6 flex items-center justify-between bg-[#0b0c0f] shrink-0 z-10">
            <div class="flex items-center gap-6">
                <span class="text-sm font-bold text-white">Servitrack</span>
                <div class="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" placeholder="Search my tasks..."
                        class="bg-[#13151b] border border-gray-800/80 rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500/50 transition w-64">
                </div>
            </div>
            <div class="flex items-center gap-4">
                <button class="text-gray-500 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                </button>
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
                        {{ strtoupper(substr(auth()->user()->name, 0, 2)) }}
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-semibold text-white leading-tight">{{ auth()->user()->name }}</p>
                    </div>
                </div>
            </div>
        </header>

        {{-- Content --}}
        <main class="flex-1 overflow-hidden">
            @yield('content')
        </main>
    </div>

    @stack('scripts')
</body>
</html>