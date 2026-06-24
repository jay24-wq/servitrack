<?php

namespace App\Http\Controllers;

use App\Models\Sparepart;
use Illuminate\Http\Request;
use App\Models\SparepartUsage;
use Carbon\Carbon;

class SparepartController extends Controller
{
    // 1. READ: Menampilkan semua data sparepart (Inventaris)
    public function index(Request $request)
    {
        // Ambil data dari input pencarian dan filter merek
        $search = $request->get('search');
        $merekFltr = $request->get('merek');

        // Query dasar untuk mengambil data sparepart
        $query = Sparepart::query();

        // Logika 1: Jika user mengetik sesuatu di kolom pencarian
        if (!empty($search)) {
            $query->where('nama', 'LIKE', '%' . $search . '%');
        }

        // Logika 2: Jika user memilih/memfilter berdasarkan merek tertentu
        if (!empty($merekFltr)) {
            $query->where('merek', $merekFltr);
        }

        // Ambil hasil akhirnya
        $spareparts = $query->get();

        // Ambil daftar semua merek unik untuk pilihan di tombol kategori/filter nantinya
        $daftarMerek = Sparepart::whereNotNull('merek')->distinct()->pluck('merek');

        $sukuCadangDigunakan = SparepartUsage::whereMonth('created_at', Carbon::now()->month)
            ->whereYear('created_at', Carbon::now()->year)
            ->sum('jumlah_digunakan');

        // Kirim data ke view index
        return view('admin.sparepart.index', compact('spareparts', 'daftarMerek', 'sukuCadangDigunakan'));
    }

    // 2. CREATE: Menyimpan data sparepart baru ke database
    public function store(Request $request)
    {
        // 1. Validasi inputan form agar aman dari error database
        $validatedData = $request->validate([
            'nama' => 'required|string|max:100',
            'merek' => 'nullable|string|max:50',
            'harga_satuan' => 'required|numeric|min:0',
            'sparepart_stock' => 'required|integer|min:0',
            'stok_minimum' => 'required|integer|min:0',
        ]);

        // 2. Simpan data ke database MySQL lewat Model
        Sparepart::create($validatedData);

        // 3. Alihkan halaman kembali ke tabel inventaris dengan status sukses
        return redirect()->route('spareparts.index')->with('success', 'Suku cadang baru berhasil ditambahkan!');
    }

    // 3. READ SPECIFIC: Mengambil satu data sparepart spesifik berdasarkan ID
    public function show($id)
    {
        $sparepart = Sparepart::find($id);

        if (!$sparepart) {
            return response()->json(['message' => 'Sparepart tidak ditemukan!'], 404);
        }

        return response()->json($sparepart, 200);
    }

    // 4. UPDATE: Mengubah data sparepart yang sudah ada
    public function update(Request $request, $id)
    {
        $request->validate([
            'nama' => 'required|string|max:255',
            'harga_satuan' => 'required|numeric',
            'sparepart_stock' => 'required|integer',
            'stok_minimum' => 'required|integer',
        ]);

        $part = Sparepart::findOrFail($id);

        // Cek LOGIKA OTOMATIS: Jika input stok baru bernilai 0 atau kurang
        if ($request->sparepart_stock <= 0) {
            $part->delete(); // Hapus permanen dari database
            return redirect()->route('spareparts.index')
                ->with('success', 'Produk otomatis dihapus karena stok telah habis (0)!');
        }

        // Jika stok masih di atas 0, perbarui data seperti biasa
        $part->update([
            'nama' => $request->nama,
            'merek' => $request->merek,
            'harga_satuan' => $request->harga_satuan,
            'sparepart_stock' => $request->sparepart_stock,
            'stok_minimum' => $request->stok_minimum,
        ]);

        return redirect()->route('spareparts.index')
            ->with('success', 'Data sparepart berhasil diperbarui!');
    }

    public function destroy($id)
    {
        $part = Sparepart::findOrFail($id);
        $part->delete(); // Hapus permanen dari database

        return redirect()->route('spareparts.index')
            ->with('success', 'Suku cadang berhasil dihapus secara permanen!');
    }
}
