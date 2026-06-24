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
        Schema::create('sparepart_usages', function (Blueprint $table) {
            $table->id();
            // Menghubungkan ke tabel 'spareparts' (ID produk suku cadang)
            // Jika produk di tabel spareparts dihapus, data riwayat di sini juga otomatis bersih (cascade)
            $table->foreignId('sparepart_id')->constrained('spareparts')->onDelete('cascade');

            // Mencatat jumlah suku cadang yang digunakan/keluar
            $table->integer('jumlah_digunakan');

            $table->timestamps(); // Otomatis membuat kolom created_at & updated_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sparepart_usages');
    }
};
