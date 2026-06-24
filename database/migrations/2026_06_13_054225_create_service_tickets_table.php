<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('service_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('kode_servis')->unique(); // Ini "Nomor Resi" pelanggan (Contoh: SRV-001)
            $table->string('nama_pelanggan');
            $table->string('nomor_hp');
            $table->string('tipe_device'); // Contoh: iPhone 13 Pro
            $table->text('keluhan');

            // STATUS LIVE TRACKING 
            $table->enum('status', [
                'antrian',
                'pengecekan',
                'menunggu part',
                'pengerjaan',
                'quality control',
                'siap diambil',
                'selesai'
            ])->default('antrian');

            // Menghubungkan ke teknisi yang memegang device ini (bisa kosong dulu saat awal masuk antrean)
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');

            $table->integer('total_biaya')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('service_tickets');
    }
};
