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
        Schema::table('payments', function (Blueprint $table){
            $table->unsignedBigInteger('biaya_sparepart')->default(0)->change();
            $table->unsignedBigInteger('biaya_jasa')->default(50000)->change();
            $table->dropColumn('total');
            $table->unsignedBigInteger('total')->storedAs('biaya_sparepart + biaya_jasa');
            $table->timestamp('tanggal_bayar')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->integer('biaya_sparepart')->default(0)->change();
            $table->integer('biaya_jasa')->default(0)->change();
            $table->integer('total')->default(0)->change();
            $table->dateTime('tanggal_bayar')->nullable()->change();
        });
    }
};
