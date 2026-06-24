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
        Schema::create('spareparts', function (Blueprint $table) {
            $table->id(); // Menggantikan id_sparepart, otomatis Primary Key & Auto Increment
            $table->string('nama'); // Nama sparepart (contoh: LCD ASUS VivoBook 14)
            $table->string('merek')->nullable(); // Merek, boleh kosong jika tidak diisi
            $table->decimal('harga_satuan', 12, 2)->default(0); // Tipe decimal agar hitungan uang presisi
            $table->integer('sparepart_stock')->default(0); // Stok saat ini
            $table->integer('stok_minimum')->default(5); // Batas minimum untuk peringatan restock
            $table->timestamps(); // Membuat kolom created_at dan updated_at secara otomatis
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('spareparts');
    }
};
