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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('service_ticket_id')->constrained()->onDelete('cascade');
            $table->integer('biaya_sparepart')->default(0);
            $table->integer('biaya_jasa')->default(0);
            $table->integer('total')->default(0);
            $table->enum('metode', ['tunai', 'qris', 'transfer'])->default('tunai');
            $table->enum('bank', ['BCA', 'Mandiri', 'BNI', 'BRI'])->nullable();
            $table->enum('status', ['lunas', 'belum'])->default('belum');
            $table->dateTime('tanggal_bayar')->nullable(); 
            $table->text('catatan')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
