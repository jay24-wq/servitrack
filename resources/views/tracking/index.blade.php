<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ServiTrack - Lacak Perbaikan</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>

<body class="bg-[#0f1115] text-gray-200 font-sans min-h-screen flex flex-col justify-between">

    <nav class="border-b border-gray-800 bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-50">
        <div class="w-full px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex-shrink-0">
                    <span class="text-xl font-bold text-white tracking-wider">ServiTrack</span>
                </div>
                    <div class="hidden md:block ml-10 space-x-8">
                        <a href="#" class="text-white border-b-2 border-white pb-5 text-sm font-medium">Dashboard</a>
                        <a href="{{ route('tracking.search') }}" class="text-gray-400 hover:text-white text-sm font-medium transition">Services</a>
                        <a href="#" class="text-gray-400 hover:text-white text-sm font-medium transition">Support</a>
                        <a href="#" class="text-gray-400 hover:text-white text-sm font-medium transition">About</a>
                    </div>
                <div class="flex items-center space-x-4">
                    <button class="border border-gray-700 hover:border-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium transition bg-[#161920]">
                        Track Repair
                    </button>
                    <button class="text-gray-400 hover:text-white transition">
                        <i class="fa-regular fa-bell text-lg"></i>
                    </button>
                    <button onclick="toggleLoginModal()" class="text-gray-400 hover:text-white transition focus:outline-none">
                        <i class="fa-regular fa-user text-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    </nav>

    <main class="flex-grow flex flex-col items-center justify-center px-4 py-16 bg-gradient-to-b from-[#13161c] to-[#0f1115]">
        <div class="max-w-2xl w-full mx-auto text-center space-y-8">
            <h1 class="text-4xl md:text-5xl font-bold text-white tracking-tight">Lacak Perbaikan Anda</h1>
            <p class="text-gray-400 text-sm md:text-base leading-relaxed">
                Masukkan nomor tanda terima atau tiket Anda di bawah ini untuk memeriksa status perbaikan perangkat elektronik Anda secara langsung.
            </p>

            @if(session('error'))
            <div class="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg text-sm text-left flex items-center space-x-2">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <span>{{ session('error') }}</span>
            </div>
            @endif

            <form id="tracking-form" action="{{ route('tracking.search') }}" method="GET" class="space-y-2">
                <div class="flex items-center bg-[#141722] border border-gray-800 rounded-lg p-2 focus-within:border-gray-600 transition shadow-xl" id="search-wrapper">
                    <div class="flex items-center pl-3 text-gray-500">
                        <i class="fa-solid fa-magnifying-glass"></i>
                    </div>
                    <input
                        type="text"
                        id="kode_servis_input"
                        name="kode_servis"
                        placeholder="Repair Ticket ID — contoh: SRV-20240610-A1B2"
                        value="{{ old('kode_servis') }}"
                        class="w-full bg-transparent border-none text-white placeholder-gray-600 px-3 py-2 focus:ring-0 focus:outline-none text-sm md:text-base"
                        autocomplete="off"
                        required>
                    <button type="submit" id="track-btn" class="bg-[#121829] hover:bg-[#1a233d] border border-gray-800 text-white font-semibold px-6 py-2.5 rounded-md text-xs tracking-widest uppercase transition-all">
                        Lacak
                    </button>
                </div>

                {{-- 🔒 Peringatan Keamanan Real-Time (dari JavaScript) --}}
                <div id="security-warning" class="hidden flex items-start gap-2 bg-red-900/40 border border-red-500/70 text-red-300 rounded-lg px-4 py-3 text-sm">
                    <i class="fa-solid fa-shield-exclamation mt-0.5 text-red-400 flex-shrink-0"></i>
                    <div>
                        <p class="font-semibold text-red-200">Karakter Berbahaya Terdeteksi!</p>
                        <p class="text-xs text-red-400/90 mt-0.5">Input mengandung karakter tidak diizinkan. Nomor resi hanya boleh berisi huruf, angka, dan tanda hubung (<code class="bg-red-900/50 px-1 rounded">A–Z, 0–9, -</code>).</p>
                    </div>
                </div>

                {{-- 🔒 Error dari Backend (Server-Side Validation) --}}
                @error('kode_servis')
                <div class="flex items-start gap-2 bg-red-900/40 border border-red-500/70 text-red-300 rounded-lg px-4 py-3 text-sm">
                    <i class="fa-solid fa-circle-xmark mt-0.5 text-red-400 flex-shrink-0"></i>
                    <div>
                        <p class="font-semibold text-red-200">Input Ditolak oleh Server</p>
                        <p class="text-xs text-red-400/90 mt-0.5">{{ $message }}</p>
                    </div>
                </div>
                @enderror
            </form>

            <div class="flex flex-wrap justify-center items-center gap-6 pt-4 text-xs">
                <div class="text-center space-y-1">
                    <span class="bg-gray-700/50 text-gray-400 px-3 py-1 rounded-md font-medium border border-gray-600/30">Diagnostic</span>
                    <p class="text-[10px] text-gray-500">Initial Inspection</p>
                </div>
                <div class="text-center space-y-1">
                    <span class="bg-blue-600/80 text-white px-3 py-1 rounded-md font-medium border border-blue-500/30 shadow-md shadow-blue-500/10">In Progress</span>
                    <p class="text-[10px] text-gray-500">Surgical Precision</p>
                </div>
                <div class="text-center space-y-1">
                    <span class="bg-emerald-600/80 text-white px-3 py-1 rounded-md font-medium border border-emerald-500/30 shadow-md shadow-emerald-500/10">Ready</span>
                    <p class="text-[10px] text-gray-500">Quality Verified</p>
                </div>
            </div>
        </div>

        <div class="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 px-4">
            <div class="bg-[#141720]/40 border border-gray-900 rounded-xl p-8 space-y-4 hover:border-gray-800/60 transition">
                <div class="w-10 h-10 bg-[#162238] border border-blue-900 text-blue-400 rounded flex items-center justify-center">
                    <i class="fa-solid fa-microchip text-sm"></i>
                </div>
                <h3 class="text-lg font-bold text-white tracking-wide">Expert Technicians</h3>
                <p class="text-gray-400 text-sm leading-relaxed">
                    Tim kami menangani setiap perangkat dengan ketelitian setingkat operasi.
                </p>
            </div>

            <div class="bg-[#141720]/40 border border-gray-900 rounded-xl p-8 space-y-4 hover:border-gray-800/60 transition bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#17232a]/20 to-transparent">
                <div class="w-10 h-10 bg-[#152a3a] border border-cyan-900 text-cyan-400 rounded flex items-center justify-center">
                    <i class="fa-solid fa-clock-rotate-left text-sm"></i>
                </div>
                <h3 class="text-lg font-bold text-white tracking-wide">Live Tracking</h3>
                <p class="text-gray-400 text-sm leading-relaxed">
                    Pantau kemajuan perbaikan Anda melalui setiap tahap alur kerja teknis kami secara real-time.
                </p>
            </div>

            <div class="bg-[#141720]/40 border border-gray-900 rounded-xl p-8 space-y-4 hover:border-gray-800/60 transition">
                <div class="w-10 h-10 bg-[#25241b] border border-yellow-950 text-yellow-500 rounded flex items-center justify-center">
                    <i class="fa-solid fa-shield text-sm"></i>
                </div>
                <h3 class="text-lg font-bold text-white tracking-wide">Guaranteed Parts</h3>
                <p class="text-gray-400 text-sm leading-relaxed">
                    Kami hanya menggunakan komponen asli bersertifikasi pabrikan untuk semua perbaikan.
                </p>
            </div>
        </div>
    </main>

    <footer class="border-t border-gray-900 bg-[#0f1115] py-8 px-4 sm:px-6 lg:px-8">
        <div class="w-full flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-500 px-4">
            <div class="space-y-1 text-center md:text-left">
                <p class="text-sm font-semibold text-gray-400">ServiTrack</p>
                <p>© 2026 ServiTrack. Surgical precision in electronics repair.</p>
            </div>
            <div class="flex flex-wrap justify-center gap-6">
                <a href="#" class="hover:text-gray-300 transition">Privacy Policy</a>
                <a href="#" class="hover:text-gray-300 transition">Terms of Service</a>
                <a href="#" class="hover:text-gray-300 transition">Contact Support</a>
                <a href="#" class="hover:text-gray-300 transition">Location Finder</a>
            </div>
        </div>
    </footer>

    <div id="loginModal" class="fixed inset-0 z-50 flex items-center justify-center hidden">
    <div onclick="toggleLoginModal()" class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <div class="relative w-full max-w-[440px] bg-[#141720] border border-gray-800/80 rounded-2xl p-10 shadow-2xl z-10 mx-4">
        <button onclick="toggleLoginModal()" class="absolute top-4 right-4 text-gray-500 hover:text-white transition">
            <i class="fa-solid fa-xmark text-lg"></i>
        </button>
        <div class="text-center mb-8">
            <h2 class="text-3xl font-bold text-white tracking-wide">ServiTrack</h2>
            <p class="text-xs text-gray-400/80 mt-1 tracking-wide">Guest Portal Access</p>
        </div>
        <form action="{{ route('login') }}" method="POST" class="space-y-5">
            @csrf
            <div>
                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Email Address</label>
                <input type="email" name="email" value="{{ old('email') }}" required placeholder="Enter your email"
                    class="w-full bg-[#11131a] border border-gray-800 rounded-md p-3 text-sm text-white outline-none placeholder-gray-600 focus:border-gray-600 transition">
                @error('email')
                    <span class="text-red-500 text-xs mt-1 block">{{ $message }}</span>
                @enderror
            </div>
            <div>
                <div class="flex justify-between items-center mb-2">
                    <label class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Password</label>
                    <a href="{{ route('password.request') }}" class="text-[10px] text-gray-500 hover:text-gray-300 transition font-medium">Forgot Password?</a>
                </div>
                <input type="password" name="password" required placeholder="Enter your password"
                    class="w-full bg-[#11131a] border border-gray-800 rounded-md p-3 text-sm text-white outline-none placeholder-gray-600 focus:border-gray-600 transition">
            </div>
            <button type="submit" class="w-full bg-[#e6e6e6] hover:bg-white text-black font-bold py-3 rounded-md text-xs tracking-widest uppercase transition-colors duration-200 mt-4">
                Sign In
            </button>
        </form>
    </div>
</div>

<script>
    function toggleLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    const hasLoginErrors = @json($errors->has('email') || $errors->has('password'));
    if (hasLoginErrors) {
        document.addEventListener("DOMContentLoaded", function() {
            toggleLoginModal();
        });
    }

    // 🔒 KEAMANAN: Validasi real-time input nomor resi
    (function () {
        const input    = document.getElementById('kode_servis_input');
        const warning  = document.getElementById('security-warning');
        const wrapper  = document.getElementById('search-wrapper');
        const trackBtn = document.getElementById('track-btn');
        const form     = document.getElementById('tracking-form');

        // Whitelist: hanya huruf, angka, dan tanda hubung
        const SAFE_PATTERN = /^[A-Za-z0-9\-]*$/;

        function isDangerous(val) {
            return val !== '' && !SAFE_PATTERN.test(val);
        }

        function showWarning() {
            warning.classList.remove('hidden');
            wrapper.classList.add('!border-red-500');
            wrapper.classList.remove('border-gray-800');
            trackBtn.disabled = true;
            trackBtn.classList.add('opacity-40', 'cursor-not-allowed');
        }

        function hideWarning() {
            warning.classList.add('hidden');
            wrapper.classList.remove('!border-red-500');
            wrapper.classList.add('border-gray-800');
            trackBtn.disabled = false;
            trackBtn.classList.remove('opacity-40', 'cursor-not-allowed');
        }

        function validateInput() {
            if (isDangerous(input.value)) {
                showWarning();
            } else {
                hideWarning();
            }
        }

        // Cek saat mengetik
        input.addEventListener('input', validateInput);

        // Cek saat paste (mencegah bypass dengan paste)
        input.addEventListener('paste', function () {
            setTimeout(validateInput, 10);
        });

        // Last-resort: blokir submit jika ada karakter berbahaya
        form.addEventListener('submit', function (e) {
            if (isDangerous(input.value)) {
                e.preventDefault();
                showWarning();
                input.focus();
            }
        });

        // Jalankan saat load (jika ada old() value dari Laravel)
        validateInput();
    })();
</script>

</body>

</html>