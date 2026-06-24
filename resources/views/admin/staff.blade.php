@extends('layouts.app')

@section('content')
<div class="max-w-[1400px] mx-auto px-10 py-8 space-y-6">

    {{-- Page Header --}}
    <div class="flex items-start justify-between">
        <div>
            <h1 class="text-4xl font-bold text-white tracking-tight">Manajemen Pengguna</h1>
            <p class="text-gray-400 mt-1">Kelola hak akses dan informasi personal teknisi serta administrator.</p>
        </div>
        <button onclick="openModal('modal-tambah')"
                class="flex items-center gap-2 px-5 py-2.5 bg-[#14161a] hover:bg-gray-800 border border-gray-700 text-white text-sm font-semibold rounded-xl transition">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Tambah Staff Baru
        </button>
    </div>

    @if(session('success'))
    <div id="toast" class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm font-semibold transition-opacity duration-500 opacity-100">
        {{ session('success') }}
    </div>
    <script>
        setTimeout(() => {
            const t = document.getElementById('toast');
            if (t) { t.classList.add('opacity-0'); setTimeout(() => t.remove(), 500); }
        }, 3000);
    </script>
    @endif

    @if(session('error'))
    <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm font-semibold">
        {{ session('error') }}
    </div>
    @endif

    {{-- ================================================================
        STAT CARDS
    ================================================================ --}}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        @foreach([
            ['label' => 'Total Admin', 'value' => $stats['total_admin'], 'color' => 'blue', 'icon' => 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
            ['label' => 'Total Teknisi', 'value' => $stats['total_teknisi'], 'color' => 'indigo', 'icon' => 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'],
            ['label' => 'Total Frontdesk', 'value' => $stats['total_frontdesk'], 'color' => 'amber', 'icon' => 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z'],
            ['label' => 'Staff Aktif', 'value' => $stats['total_aktif'], 'color' => 'emerald', 'icon' => 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'],
        ] as $card)
        <div class="bg-[#14161a] border border-gray-800 rounded-xl p-5 flex items-center gap-4">
            <div class="p-3 bg-{{ $card['color'] }}-500/10 border border-{{ $card['color'] }}-500/20 rounded-xl shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-{{ $card['color'] }}-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="{{ $card['icon'] }}" />
                </svg>
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ $card['label'] }}</p>
                <p class="text-3xl font-bold text-white mt-0.5">{{ $card['value'] }}</p>
            </div>
        </div>
        @endforeach
    </div>

    {{-- ================================================================
        TABLE
    ================================================================ --}}
    <div class="bg-[#14161a] border border-gray-800 rounded-xl overflow-hidden">

        {{-- Table Header --}}
        <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
            {{-- Role Filter --}}
            <form method="GET" action="{{ route('admin.staff') }}" id="filter-form" class="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
                @foreach(['semua' => 'Semua', 'admin' => 'Admin', 'teknisi' => 'Teknisi', 'frontdesk' => 'Front desk'] as $val => $label)
                <button type="submit" name="role" value="{{ $val }}"
                        class="px-4 py-1.5 text-xs font-semibold rounded-md transition
                        {{ (request('role', 'semua') === $val) ? 'bg-white text-black' : 'text-gray-500 hover:text-white' }}">
                    {{ $label }}
                </button>
                @endforeach
            </form>

            {{-- Sort --}}
            <div class="flex items-center gap-3">
                <span class="text-xs text-gray-500">Urutkan:</span>
                <div class="relative">
                    <select name="sort" onchange="document.getElementById('sort-form').submit()"
                            class="bg-gray-900 border border-gray-800 rounded-lg pl-3 pr-8 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500 appearance-none cursor-pointer">
                        <option value="name_asc" {{ request('sort', 'name_asc') === 'name_asc' ? 'selected' : '' }}>Nama (A-Z)</option>
                        <option value="name_desc" {{ request('sort') === 'name_desc' ? 'selected' : '' }}>Nama (Z-A)</option>
                    </select>
                    <form method="GET" action="{{ route('admin.staff') }}" id="sort-form">
                        <input type="hidden" name="role" value="{{ request('role', 'semua') }}">
                        <input type="hidden" name="sort" id="sort-value" value="{{ request('sort', 'name_asc') }}">
                    </form>
                    <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>

        {{-- Table --}}
        <table class="w-full text-left border-collapse">
            <thead>
                <tr class="border-b border-gray-800 text-gray-500 text-xs font-semibold uppercase tracking-wider bg-gray-900/30">
                    <th class="px-6 py-4">Nama Staff</th>
                    <th class="px-6 py-4">Peran</th>
                    <th class="px-6 py-4">No. WhatsApp</th>
                    <th class="px-6 py-4">Status Akun</th>
                    <th class="px-6 py-4 text-center">Aksi</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/60 text-sm">
                @forelse($users as $user)
                <tr class="hover:bg-gray-900/20 transition {{ !$user->is_active ? 'opacity-50' : '' }}">

                    {{-- Nama Staff --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0
                                {{ $user->is_active ? 'bg-gradient-to-tr from-indigo-500 to-blue-600' : 'bg-gray-700' }}">
                                {{ strtoupper(substr($user->name, 0, 2)) }}
                            </div>
                            <div>
                                <p class="font-semibold text-white">{{ $user->name }}</p>
                                <p class="text-xs text-gray-500 mt-0.5">{{ $user->email }}</p>
                            </div>
                        </div>
                    </td>

                    {{-- Peran --}}
                    <td class="px-6 py-4">
                        @php
                            $roleStyle = [
                                'admin'   => 'bg-blue-500/10 border-blue-500/20 text-blue-400',
                                'teknisi' => 'bg-gray-800 border-gray-700 text-gray-400',
                                'frontdesk' => 'bg-amber-500/10 border-amber-500/20 text-amber-400',
                            ];
                        @endphp
                        <span class="px-3 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider {{ $roleStyle[$user->role] ?? 'bg-gray-800 border-gray-700 text-gray-400' }}">
                            {{ $user->role }}
                        </span>
                    </td>

                    {{-- No HP --}}
                    <td class="px-6 py-4 text-gray-400 text-sm">
                        {{ $user->phone ?? '—' }}
                    </td>

                    {{-- Status --}}
                    <td class="px-6 py-4">
                        @if($user->is_active)
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span class="text-sm text-emerald-400 font-medium">Aktif</span>
                            </div>
                        @else
                            <div class="flex items-center gap-2">
                                <span class="w-2 h-2 rounded-full bg-gray-600"></span>
                                <span class="text-sm text-gray-500 font-medium italic">Non-aktif</span>
                            </div>
                        @endif
                    </td>

                    {{-- Aksi --}}
                    <td class="px-6 py-4">
                        <div class="flex items-center justify-center gap-2">
                            {{-- Edit --}}
                            <button onclick="openEditModal({{ $user->id }})"
                                    class="p-1.5 bg-gray-900 hover:bg-blue-500/10 border border-gray-800 hover:border-blue-500/30 text-gray-500 hover:text-blue-400 rounded-lg transition"
                                    title="Edit Staff">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>

                            {{-- Toggle Active --}}
                            @if($user->id !== auth()->id())
                            <form method="POST" action="{{ route('admin.staff.toggle', $user) }}" class="inline">
                                @csrf
                                @method('PATCH')
                                <button type="submit"
                                        class="p-1.5 bg-gray-900 hover:bg-red-500/10 border border-gray-800 hover:border-red-500/30 text-gray-500 hover:text-red-400 rounded-lg transition"
                                        title="{{ $user->is_active ? 'Nonaktifkan' : 'Aktifkan' }}">
                                    @if($user->is_active)
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                    </svg>
                                    @else
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    @endif
                                </button>
                            </form>
                            @else
                            <span class="p-1.5 text-gray-700 cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                            </span>
                            @endif
                        </div>

                        {{-- Modal Edit (per user) --}}
                        <div id="modal-edit-{{ $user->id }}" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
                            <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4">
                                <h2 class="text-lg font-bold text-white mb-5 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Staff
                                </h2>
                                <form method="POST" action="{{ route('admin.staff.update', $user) }}" class="space-y-4">
                                    @csrf
                                    @method('PUT')
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nama Lengkap</label>
                                            <input type="text" name="name" value="{{ $user->name }}" required
                                                class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peran</label>
                                            <select name="role" class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none">
                                                <option value="admin" {{ $user->role === 'admin' ? 'selected' : '' }}>Admin</option>
                                                <option value="teknisi" {{ $user->role === 'teknisi' ? 'selected' : '' }}>Teknisi</option>
                                                <option value="frontdesk" {{ $user->role === 'frontdesk' ? 'selected' : '' }}>Front desk</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
                                        <input type="email" name="email" value="{{ $user->email }}" required
                                            class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">No. WhatsApp</label>
                                        <input type="text" name="phone" value="{{ $user->phone }}"
                                            class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                            placeholder="081200000000">
                                    </div>
                                    <div class="grid grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Password Baru <span class="text-gray-600 font-normal normal-case">(opsional)</span></label>
                                            <input type="password" name="password"
                                                class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Konfirmasi Password</label>
                                            <input type="password" name="password_confirmation"
                                                class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                                        </div>
                                    </div>
                                    <div class="flex gap-3 justify-end pt-2">
                                        <button type="button" onclick="closeModal('modal-edit-{{ $user->id }}')"
                                                class="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Batal</button>
                                        <button type="submit"
                                                class="bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                                            Simpan Perubahan
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-gray-600">Belum ada staff terdaftar</td>
                </tr>
                @endforelse
            </tbody>
        </table>

        {{-- Pagination --}}
        @if($users->hasPages())
        <div class="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <p class="text-xs text-gray-500">
                Menampilkan {{ $users->firstItem() }}-{{ $users->lastItem() }} dari {{ $users->total() }} staff
            </p>
            <div class="flex items-center gap-1">
                @if($users->onFirstPage())
                    <span class="px-3 py-1.5 text-xs text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">‹</span>
                @else
                    <a href="{{ $users->previousPageUrl() }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">‹</a>
                @endif

                @foreach($users->getUrlRange(1, $users->lastPage()) as $page => $url)
                    @if($page == $users->currentPage())
                        <span class="px-3 py-1.5 text-xs font-bold text-white bg-blue-600/20 border border-blue-500/30 rounded-lg">{{ $page }}</span>
                    @else
                        <a href="{{ $url }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">{{ $page }}</a>
                    @endif
                @endforeach

                @if($users->hasMorePages())
                    <a href="{{ $users->nextPageUrl() }}" class="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-lg transition">›</a>
                @else
                    <span class="px-3 py-1.5 text-xs text-gray-700 bg-gray-900 border border-gray-800 rounded-lg cursor-not-allowed">›</span>
                @endif
            </div>
        </div>
        @endif
    </div>
</div>

{{-- Modal Tambah Staff --}}
<div id="modal-tambah" class="hidden fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
    <div class="bg-[#14161a] border border-gray-800 rounded-xl p-6 w-full max-w-lg shadow-2xl mx-4">
        <h2 class="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Tambah Staff Baru
        </h2>
        <form method="POST" action="{{ route('admin.staff.store') }}" class="space-y-4">
            @csrf
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Nama Lengkap <span class="text-red-400">*</span></label>
                    <input type="text" name="name" required
                            class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                            placeholder="e.g. Budi Santoso">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Peran <span class="text-red-400">*</span></label>
                    <select name="role" required class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 appearance-none">
                        <option value="admin">Admin</option>
                        <option value="teknisi">Teknisi</option>
                        <option value="frontdesk">Front desk</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Email <span class="text-red-400">*</span></label>
                <input type="email" name="email" required
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                        laceholder="staff@servitrack.com">
            </div>
            <div>
                <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">No. WhatsApp</label>
                <input type="text" name="phone"
                        class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                        placeholder="+62 812 0000 0000">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Password <span class="text-red-400">*</span></label>
                    <input type="password" name="password" required
                            class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Konfirmasi Password <span class="text-red-400">*</span></label>
                    <input type="password" name="password_confirmation" required
                            class="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
            </div>
            <div class="flex gap-3 justify-end pt-2">
                <button type="button" onclick="closeModal('modal-tambah')"
                        class="px-4 py-2 text-sm text-gray-400 hover:text-white transition">Batal</button>
                <button type="submit"
                        class="bg-blue-600/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-400 hover:text-white font-semibold px-5 py-2 rounded-lg text-sm transition">
                    Tambah Staff
                </button>
            </div>
        </form>
    </div>
</div>
@endsection

@push('scripts')
<script>
    function openModal(id) {
        document.getElementById(id).classList.remove('hidden');
    }
    function closeModal(id) {
        document.getElementById(id).classList.add('hidden');
    }
    function openEditModal(id) {
        document.getElementById('modal-edit-' + id).classList.remove('hidden');
    }

    // Auto-open modal jika ada validation error
    @if($errors->any())
        openModal('modal-tambah');
    @endif
</script>
@endpush