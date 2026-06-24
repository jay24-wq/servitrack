<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sparepart extends Model
{
    // Mengizinkan kolom-kolom ini diisi melalui form/request laravel
    protected $fillable = [
        'nama',
        'merek',
        'harga_satuan',
        'sparepart_stock',
        'stok_minimum'
    ];
}
