<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'ServiTrack Admin')</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
    </style>
    @stack('styles')
</head>
<body class="bg-[#0b0c0f] text-gray-400 font-sans h-screen flex overflow-hidden">

    {{-- SIDEBAR --}}
    <aside class="w-64 bg-[#0f1115] border-r border-gray-900/50 flex flex-col justify-between h-full shrink-0">
        <div>
            <div class="p-6 border-b border-gray-900/50">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-indigo-600/10 rounded-lg text-indigo-400">
                        <i class="fa-solid fa-laptop text-lg"></i>
                    </div>
                    <div>
                        <h2 class="text-sm font-bold text-white tracking-wide uppercase">Main Workshop</h2>
                        <p class="text-[10px] text-gray-500 tracking-wider uppercase font-semibold">
                            {{ Auth::user()->name }}
                        </p>
                    </div>
                </div>
            </div>

            <nav class="p-4 space-y-1.5">
                @if(Auth::user()->role === 'admin')
                <a href="{{ route('admin.dashboard') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.dashboard') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-table-cells-large w-5"></i>
                    <span>Dashboard</span>
                </a>
                <a href="{{ route('admin.queue') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.queue*') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-list-ul w-5"></i>
                    <span>Queue</span>
                </a>
                <a href="{{ route('admin.sparepart.index') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.sparepart.index') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-box-archive w-5"></i>
                    <span>Inventory</span>
                </a>
                <a href="#"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.costumers*') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-users w-5"></i>
                    <span>Customers</span>
                </a>
                <a href="{{ route('admin.staff') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.staff*') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-user-gear w-5"></i>
                    <span>Staff Management</span>
                </a>
                <a href="{{ route('admin.payment') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.payment*') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-regular fa-money-bill-1 w-5"></i>
                    <span>Payments</span>
                </a>
                <a href="{{ route('admin.reports') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.reports*') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-regular fa-chart-bar w-5"></i>
                    <span>Reports</span>
                </a>
                @endif

                @if(Auth::user()->role === 'frontdesk')
                <a href="{{ route('admin.tickets.create') }}"
                class="flex items-center space-x-3 px-4 py-3 rounded-lg font-medium text-sm transition
                {{ request()->routeIs('admin.tickets.create') ? 'bg-gradient-to-r from-indigo-600/10 to-transparent text-white border-l-2 border-indigo-500 rounded-r-lg' : 'text-gray-500 hover:text-gray-300' }}">
                    <i class="fa-solid fa-ticket w-5"></i>
                    <span>Form Frontdesk</span>
                </a>
                @endif
            </nav>
        </div>

        <div class="p-4 space-y-3 border-t border-gray-900/50">
            <a href="{{ route('admin.tickets.create') }}"
            class="w-full py-2.5 bg-[#cbd5e1] hover:bg-[#b8c5d6] text-black text-center font-bold text-xs rounded-md block uppercase tracking-wider transition">
                + New Ticket
            </a>
            <a href="#" class="flex items-center space-x-3 px-4 py-1 text-xs text-gray-500 hover:text-gray-300 transition">
                <i class="fa-solid fa-circle-question w-4"></i>
                <span>Support</span>
            </a>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button type="submit"
                        class="w-full flex items-center space-x-3 px-4 py-1 text-xs text-gray-500 hover:text-red-400 transition">
                    <i class="fa-solid fa-arrow-right-from-bracket w-4"></i>
                    <span>Logout</span>
                </button>
            </form>
        </div>
    </aside>

    {{-- MAIN AREA --}}
    <div class="flex-1 flex flex-col h-full overflow-hidden relative">

        {{-- Header --}}
        <header class="h-16 border-b border-gray-900/50 px-12 flex items-center justify-between bg-[#0b0c0f] shrink-0 z-10">
            <div class="flex items-center space-x-8 flex-1">
                <span class="text-sm font-bold text-white tracking-wider">ServiTrack</span>
                <div class="relative w-80">
                    <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
                    <input type="text" placeholder="Search Tickets..."
                        class="w-full bg-[#13151b] border border-gray-800/80 rounded-md pl-9 pr-4 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500/50 transition">
                </div>
            </div>
            <div class="flex items-center space-x-4">
                <button class="text-gray-500 hover:text-white transition"><i class="fa-regular fa-bell text-sm"></i></button>
                <button class="text-gray-500 hover:text-white transition"><i class="fa-solid fa-gear text-sm"></i></button>
                <div class="w-7 h-7 rounded-md bg-gradient-to-tr from-amber-500 to-indigo-600 p-[1px]">
                    <div class="w-full h-full bg-[#13151b] rounded-md flex items-center justify-center text-[10px] text-white font-bold">
                        {{ strtoupper(substr(auth()->user()->name ?? 'GU', 0, 2)) }}
                    </div>
                </div>
            </div>
        </header>

        {{-- Content --}}
        <main class="flex-1 overflow-y-auto">
            @yield('content')

            @if(isset($slot) && !is_array($slot))
                {{ $slot }}
            @endif
        </main>

    </div>

    @stack('scripts')
</body>
</html>