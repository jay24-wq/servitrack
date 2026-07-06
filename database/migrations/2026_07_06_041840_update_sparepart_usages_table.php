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
        Schema::table('sparepart_usages', function (Blueprint $table) {
            $table->foreignId('service_ticket_id')->after('id')->constrained('service_tickets')->onDelete('cascade');
            $table->unsignedInteger('jumlah_digunakan')->change();
            $table->unsignedBigInteger('total_harga')->nullable();

            $table->dropForeign(['sparepart_id']);
            $table->foreign('sparepart_id')->references('id')->on('spareparts')->onDelete('restrict');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sparepart_usages', function (Blueprint $table) {
            $table->dropColumn('service_ticket_id');
            $table->integer('jumlah_digunakan')->change();
            $table->dropColumn('total_harga');

            $table->dropForeign(['sparepart_id']);
            $table->foreign('sparepart_id')->references('id')->on('spareparts')->onDelete('cascade');
        });
    }
};
