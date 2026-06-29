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

    public function apiList()
    {
        $spareparts = \App\Models\Sparepart::select('id', 'nama', 'merek', 'harga_satuan', 'sparepart_stock')
            ->orderBy('nama')
            ->get()
            ->map(function ($part) {
                return [
                    'id'      => $part->id,
                    'label'   => $part->nama . ($part->merek ? ' — ' . $part->merek : ''),
                    'harga'   => $part->harga_satuan,
                    'stok'    => $part->sparepart_stock,
                    'tersedia'=> $part->sparepart_stock > 0,
                ];
            });

        return response()->json($spareparts);
    }
}