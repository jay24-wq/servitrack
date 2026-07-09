<?php

namespace App\Http\Controllers;

use App\Models\ServiceTicket;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DevicePhotoController extends Controller
{
    /**
     * ============================================================
     * SECURE SERVING - Menampilkan Foto dari Private Storage
     * ============================================================
     * KEAMANAN:
     * 1. Dilindungi Middleware 'auth' (ditangani di Route/Controller).
     * 2. Mencegah IDOR: Memastikan pengguna memiliki hak akses (Policy)
     *    sebelum file dikirim ke browser.
     * 3. Mencegah directory traversal (../) karena path dikontrol ketat
     *    dari database, bukan input text dari user.
     * ============================================================
     */
    public function show(ServiceTicket $ticket): BinaryFileResponse
    {
        // 🔒 KEAMANAN: Cek otorisasi berdasarkan ServiceTicketPolicy
        // Admin bisa melihat semua, sedangkan Teknisi hanya tiket miliknya.
        Gate::authorize('view', $ticket);

        // Pastikan tiket memiliki data foto
        if (!$ticket->device_photo) {
            abort(404, 'Foto perangkat tidak ditemukan pada tiket ini.');
        }

        // Cek keberadaan file di private storage (disk: local)
        if (!Storage::disk('local')->exists($ticket->device_photo)) {
            abort(404, 'File foto tidak ditemukan di penyimpanan server.');
        }

        // Dapatkan path absolut dari file private
        $absolutePath = Storage::disk('local')->path($ticket->device_photo);

        // Ambil MIME type asli file untuk dikirimkan dalam header response
        $mimeType = Storage::disk('local')->mimeType($ticket->device_photo);

        // Kirim file ke browser dengan header yang aman
        return response()->file($absolutePath, [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline', // Ditampilkan langsung di browser, bukan diunduh
            'X-Content-Type-Options' => 'nosniff', // Mencegah browser menebak MIME type (MIME sniffing attack)
        ]);
    }
}
