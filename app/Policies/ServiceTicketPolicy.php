<?php

namespace App\Policies;

use App\Models\ServiceTicket;
use App\Models\User;

/**
 * ============================================================
 * POLICY: ServiceTicketPolicy
 * ============================================================
 * Mencegah IDOR (Insecure Direct Object Reference)
 * 
 * Logika Otorisasi:
 * - Admin   : Bisa melihat dan mengelola SEMUA tiket
 * - Frontdesk: Bisa membuat tiket baru (tidak bisa view/edit)
 * - Teknisi : HANYA bisa melihat/mengupdate tiket yang ditugaskan kepadanya
 *             (user_id == auth()->id())
 * 
 * Tanpa policy ini, teknisi bisa mengganti ID di URL untuk
 * mengakses tiket milik teknisi lain:
 *   /teknisi/tickets/123/status → /teknisi/tickets/456/status
 * ============================================================
 */
class ServiceTicketPolicy
{
    /**
     * Admin selalu diizinkan untuk semua aksi.
     * Method ini dipanggil SEBELUM method lain — jika return true,
     * method spesifik di bawah akan di-skip.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return null; // Lanjutkan ke method spesifik di bawah
    }

    /**
     * Apakah user boleh melihat detail tiket ini?
     */
    public function view(User $user, ServiceTicket $ticket): bool
    {
        // Teknisi hanya bisa lihat tiket yang ditugaskan padanya
        return $user->id === $ticket->user_id;
    }

    /**
     * Apakah user boleh mengupdate tiket ini?
     */
    public function update(User $user, ServiceTicket $ticket): bool
    {
        return $user->id === $ticket->user_id;
    }

    /**
     * Apakah user boleh mengubah status tiket ini?
     */
    public function updateStatus(User $user, ServiceTicket $ticket): bool
    {
        return $user->id === $ticket->user_id;
    }

    /**
     * Apakah user boleh mengupdate detail (modal Kondisi A/B/C/D)?
     */
    public function updateDetail(User $user, ServiceTicket $ticket): bool
    {
        return $user->id === $ticket->user_id;
    }
}
