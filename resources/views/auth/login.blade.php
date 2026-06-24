<!DOCTYPE html>
<html lang="id">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login Internal - ServiTrack</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>

<body class="bg-[#0f1115] text-gray-300 font-sans min-h-screen flex items-center justify-center p-4">

    <div class="max-w-md w-full bg-[#141720] border border-gray-800 rounded-xl p-8 shadow-2xl">
        <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-white tracking-wider">ServiTrack</h1>
            <p class="text-xs text-gray-500 mt-1 uppercase tracking-widest">Internal Portal Gateway</p>
        </div>

        <form action="{{ route('login') }}" method="POST" class="space-y-5">
            @csrf

            <div>
                <label class="text-xs font-semibold text-gray-400 block mb-2">Alamat Email</label>
                <input type="email" name="email" value="{{ old('email') }}" required class="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-3 text-sm text-white outline-none focus:border-amber-500 transition">
                @error('email')
                <span class="text-red-500 text-xs mt-1 block">{{ $message }}</span>
                @enderror
            </div>

            <div>
                <label class="text-xs font-semibold text-gray-400 block mb-2">Kata Sandi</label>
                <input type="password" name="password" required class="w-full bg-[#0f1115] border border-gray-700 rounded-lg p-3 text-sm text-white outline-none focus:border-amber-500 transition">
            </div>

            <button type="submit" class="w-full bg-amber-500 hover:bg-amber-600 text-[#0f1115] font-bold py-3 rounded-lg text-sm tracking-wide uppercase transition mt-2">
                Masuk Sistem
            </button>
        </form>
    </div>

</body>

</html>