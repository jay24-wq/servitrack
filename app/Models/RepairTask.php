<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RepairTask extends Model
{
    protected $fillable = [
        'service_ticket_id',
        'nama_tugas',
        'status_tugas',
    ];

    public function ticket()
    {
        return $this->belongsTo(ServiceTicket::class);
    }
}