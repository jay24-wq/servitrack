<?php

namespace App\Http\Controllers\Teknisi;

use App\Http\Controllers\Controller;
use App\Models\Sparepart;
use Illuminate\Http\Request;

class StokKomponenController extends Controller
{
    public function index(Request $request)
    {
        $query = Sparepart::query();

        // Filter kategori/merek
        if ($request->filled('merek')) {
            $query->where('merek', $request->merek);
        }

        $spareparts  = $query->paginate(5)->withQueryString();
        
        // OPTIMASI: Hapus select(), tambah orderBy agar urut abjad A-Z
        $daftarMerek = Sparepart::distinct()
                            ->whereNotNull('merek')
                            ->orderBy('merek', 'asc') 
                            ->pluck('merek');

        return view('teknisi.stok-komponen', compact('spareparts', 'daftarMerek'));
    }
}