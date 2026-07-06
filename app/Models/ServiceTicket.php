<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTicket extends Model
{
    protected $fillable = [
        'kode_servis',
        'nama_pelanggan',
        'nomor_hp',
        'email',
        'device_name',
        'device_brand',
        'device_serial',
        'device_condition',
        'checkin_date',
        'keluhan',
        'status',
        'sub_status',
        'user_id',
        'total_biaya',
        'catatan_teknisi',
    ];

    protected $casts = [
        'checkin_date' => 'date',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function tasks()
    {
        return $this->hasMany(RepairTask::class);
    }

    public function payment()
    {
        return $this->hasOne(Payment::class);
    }

    public function sparepartUsages()
    {
        return $this->hasMany(SparepartUsage::class);
    }
}