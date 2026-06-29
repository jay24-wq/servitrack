<?php

use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SparepartController;
use App\Http\Controllers\TrackingController;
use App\Http\Controllers\RepairTaskController;
use App\Http\Controllers\Admin\TicketController as AdminTicketController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\Admin\PaymentController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Teknisi\TicketController as TeknisiTicketController;
use App\Http\Controllers\Teknisi\StokKomponenController;

// Halaman utama tempat input nomor resi/tiket
Route::get('/', [TrackingController::class, 'index'])->name('tracking.index');

// Halaman hasil pencarian status live tracking
Route::get('/track', [TrackingController::class, 'search'])->name('tracking.search');

Route::middleware(['auth', 'verified'])->group(function () {

    Route::get('/dashboard', function () {
        if (Auth::user()->role === 'admin') {
            return redirect()->route('admin.dashboard'); // Tampilan dashboard bawaan Breeze untuk Admin
        } elseif (Auth::user()->role === 'teknisi') {
            return redirect()->route('teknisi.dashboard'); // Lempar teknisi ke halaman kerjanya
        } elseif (Auth::user()->role === 'frontdesk') {
            return redirect()->route('admin.tickets.create'); // Lempar frontdesk ke halaman pembuatan tiket/check-in
        }

        abort(403, 'Role tidak dikenali.');
    })->name('dashboard');

    // Pengaturan Akun Profil (Bisa diakses baik oleh Admin maupun Teknisi)
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // 🔴 GRUP AKSES BERSAMA (ADMIN & FRONTDESK)
    Route::middleware(['role:admin,frontdesk'])->group(function () {
        Route::prefix('admin')->name('admin.')->group(function () {
            Route::get('/tickets/create', [AdminTicketController::class, 'create'])->name('tickets.create');
            Route::post('/tickets', [AdminTicketController::class, 'store'])->name('tickets.store');
        });
    });

    // 🔴 GRUP KHUSUS ADMIN
    Route::middleware(['role:admin'])->group(function () {
        Route::prefix('admin')->name('admin.')->group(function () {
            Route::get('/dashboard', [AdminTicketController::class, 'overview'])->name('dashboard');
            Route::get('/tickets/{ticket}', [AdminTicketController::class, 'show'])->name('tickets.show');
            Route::patch('/tickets/{ticket}/status', [AdminTicketController::class, 'updateStatus'])->name('tickets.updateStatus');
            Route::get('/queue', [AdminTicketController::class, 'queue'])->name('queue');
            Route::resource('sparepart', SparepartController::class);
            Route::get('/staff', [StaffController::class, 'index'])->name('staff');
            Route::post('/staff', [StaffController::class, 'store'])->name('staff.store');
            Route::put('/staff/{user}', [StaffController::class, 'update'])->name('staff.update');
            Route::patch('/staff/{user}/toggle', [StaffController::class, 'toggleActive'])->name('staff.toggle');
            Route::get('/payment', [PaymentController::class, 'index'])->name('payment');
            Route::get('/payment/search', [PaymentController::class, 'search'])->name('payment.search');
            Route::post('/payment', [PaymentController::class, 'store'])->name('payment.store');
            Route::get('/reports', [AdminTicketController::class, 'reports'])->name('reports');
        });
    });

    // 🔵 GRUP KHUSUS TEKNISI
    Route::middleware(['role:teknisi'])->group(function () {
        Route::prefix('teknisi')->name('teknisi.')->group(function () {
            // 💡 PERBAIKAN: Mengubah URL menjadi /teknisi/... dan mencocokkan nama fungsi menjadi 'updateStatus'
            Route::get('/teknisi/dashboard', [App\Http\Controllers\RepairTaskController::class, 'index'])->name('teknisi.dashboard');
            Route::patch('/teknisi/sub-task/{id}/update', [RepairTaskController::class, 'updateStatus'])->name('teknisi.tasks.update');
            Route::get('/dashboard', [TeknisiTicketController::class, 'dashboard'])->name('dashboard');
            Route::get('/my-tasks', [TeknisiTicketController::class, 'index'])->name('my-tasks');
            Route::patch('/tickets/{service_ticket}/status', [TeknisiTicketController::class, 'updateStatus'])->name('tickets.updateStatus');
            Route::patch('/tickets/{service_ticket}/update-detail', [TeknisiTicketController::class, 'updateDetail'])->name('tickets.updateDetail');
            Route::get('/stok', [StokKomponenController::class, 'index'])->name('stok.index');
            // Halaman kerjaan teknisi lainnya (Buka jika sudah membuat)
            // Route::post('/tickets/{id}/update-status', [TeknisiController::class, 'updateStatus']);
        });
    });
});

// Rute sistem Autentikasi bawaan Laravel Breeze (Login, Register, Logout)
require __DIR__ . '/auth.php';
