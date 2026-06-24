<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            // Hapus kolom lama yang akan diganti
            $table->dropColumn('tipe_device');

            // Kolom pelanggan
            $table->string('email')->nullable()->after('nomor_hp');

            // Kolom device detail
            $table->string('device_name', 100)->after('email');
            $table->string('device_brand', 50)->nullable()->after('device_name');
            $table->string('device_serial', 50)->after('device_brand');
            $table->string('device_condition', 255)->nullable()->after('device_serial');
            $table->date('checkin_date')->after('device_condition');
        });
    }

    public function down(): void
    {
        Schema::table('service_tickets', function (Blueprint $table) {
            $table->string('tipe_device');
            $table->dropColumn([
                'email',
                'device_name',
                'device_brand',
                'device_serial',
                'device_condition',
                'checkin_date',
            ]);
        });
    }
};