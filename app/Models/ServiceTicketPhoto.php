<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceTicketPhoto extends Model
{
    protected $fillable = [
        'service_ticket_id', 
        'url', 
        'keterangan'
    ];

    public function ticket()
    {
        return $this->belongsTo(ServiceTicket::class, 'service_ticket_id');
    }
}