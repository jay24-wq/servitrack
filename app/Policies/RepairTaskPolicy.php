<?php

namespace App\Policies;

use App\Models\RepairTask;
use App\Models\User;

/**
 * ============================================================
 * POLICY: RepairTaskPolicy
 * ============================================================
 * Mencegah IDOR pada sub-task perbaikan.
 * 
 * SEBELUMNYA (Rentan IDOR):
 *   $task = RepairTask::findOrFail($id);
 *   $task->update(['status_tugas' => $request->status_tugas]);
 *   // ↑ Tidak ada pengecekan! Teknisi A bisa update task milik Teknisi B
 * 
 * SESUDAHNYA (Dengan Policy):
 *   $this->authorize('update', $task);
 *   // ↑ Otomatis cek apakah task ini milik teknisi yang login
 * ============================================================
 */
class RepairTaskPolicy
{
    /**
     * Admin selalu diizinkan.
     */
    public function before(User $user, string $ability): ?bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return null;
    }

    /**
     * Apakah user boleh mengupdate status sub-task ini?
     * 
     * Pengecekan: Sub-task terkait tiket yang ditugaskan ke teknisi ini.
     */
    public function update(User $user, RepairTask $task): bool
    {
        // Load relasi tiket induk jika belum di-load
        $task->loadMissing('serviceTicket');

        // Cek apakah tiket induk ditugaskan ke teknisi yang login
        return $task->serviceTicket && $task->serviceTicket->user_id === $user->id;
    }
}
