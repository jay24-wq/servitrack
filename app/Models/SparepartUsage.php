<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SparepartUsage extends Model
{
    protected $table = 'sparepart_usages';

    protected $fillable = [
        'service_ticket_id',
        'sparepart_id', 
        'jumlah_digunakan',
        'total_harga',
    ];

    public function serviceTicket()
    {
        return $this->belongsTo(ServiceTicket::class);
    }

    public function sparepart()
    {
        return $this->belongsTo(Sparepart::class);
    }
}
