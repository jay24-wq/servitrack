<?php

namespace App\Http\Controllers;

use App\Models\RepairTask;
use App\Models\ServiceTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RepairTaskController extends Controller
{
    /**
     * Dashboard Teknisi: Menampilkan sub-task dari tiket yang sedang ditugaskan kepadanya
     */
    public function showPanel()
    {
        // Mencari tiket perbaikan yang dipegang oleh teknisi yang sedang login saat ini
        // Kita gunakan data sampel TRK-8829 atau tiket pertama yang berstatus pengerjaan
        $ticket = ServiceTicket::with('tasks')
            ->where('status', 'pengerjaan')
            ->where('user_id', Auth::id()) // Memastikan tiket sesuai dengan id teknisi yang login
            ->first();

        // Jika tidak ada tiket pengerjaan aktif di database, beri objek kosong agar tidak eror saat demo
        if (!$ticket) {
            $ticket = new \stdClass();
            $ticket->tasks = [];
        }

        return view('teknisi.dashboard', compact('ticket'));
    }

    /**
     * Update status sub-task tindakan mekanik secara riil ke database
     */
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status_tugas' => 'required|in:belum,sedang,selesai'
        ]);

        // Cari sub-task di database dan perbarui status warnanya
        $task = RepairTask::findOrFail($id);

        // 🔒 KEAMANAN: Cek otorisasi berdasarkan RepairTaskPolicy
        $this->authorize('update', $task);

        $task->update([
            'status_tugas' => $request->status_tugas
        ]);

        return redirect()->back()->with('success', 'Progress sub-task berhasil diperbarui di database!');
    }
}
