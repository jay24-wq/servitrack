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
        Schema::create('repair_tasks', function (Blueprint $table) {
            $table->id();
            // Menghubungkan tugas dengan tiket servis utama
            $table->foreignId('service_ticket_id')->constrained('service_tickets')->onDelete('cascade');
            $table->string('nama_tugas');
            // Status tugas memakai enum: belum, sedang, selesai
            $table->enum('status_tugas', ['belum', 'sedang', 'selesai'])->default('belum');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('repair_tasks');
    }
};
