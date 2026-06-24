<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'service_ticket_id',
        'biaya_sparepart',
        'biaya_jasa',
        'total',
        'metode',
        'bank',
        'status',
        'tanggal_bayar',
        'catatan',
    ];

    public function ticket()
    {
        return $this->belongsTo(ServiceTicket::class);
    }

    protected static function booted()
    {
        static::updating(function ($payment) {
            if ($payment->isDirty('status') && $payment->status === 'lunas') {
            $payment->tanggal_bayar = now();
            }
        });
    }
}
