<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        // 1. Jika user belum login sama sekali, tendang ke halaman login
        if (!Auth::check()) {
            return redirect()->route('login')->with('error', 'Silakan login terlebih dahulu!');
        }

        // 1b. 🔒 KEAMANAN: Jika user dinonaktifkan (is_active === false), logout secara paksa
        if (!Auth::user()->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            return redirect()->route('login')->with('error', 'Akun Anda dinonaktifkan. Silakan hubungi Administrator.');
        }

        // 2. Jika user sudah login DAN rolenya masuk dalam daftar, loloskan!
        if (in_array(Auth::user()->role, $roles)) {
            return $next($request);
        }

        // 3. Jika tidak sesuai, kembalikan ke halaman sebelumnya (lebih aman dari loop)
        if ($request->expectsJson()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return redirect()->back()->with('error', 'Anda tidak memiliki hak akses ke halaman tersebut!');
    }
}
