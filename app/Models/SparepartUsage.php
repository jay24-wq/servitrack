<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SparepartUsage extends Model
{
    use HasFactory;

    protected $table = 'sparepart_usages';
    protected $fillable = ['sparepart_id', 'jumlah_digunakan'];
}
