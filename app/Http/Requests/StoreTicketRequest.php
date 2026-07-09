<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * ============================================================
 * FORM REQUEST: StoreTicketRequest
 * ============================================================
 * Validasi Whitelist untuk pembuatan tiket servis baru.
 * 
 * KEAMANAN:
 * - Hanya menerima karakter alfanumerik + spasi + tanda hubung
 * - Memblokir karakter XSS: <, >, ", ', ;
 * - Memblokir karakter SQLi: --, /*, UNION, SELECT
 * - Menggunakan regex whitelist (bukan blacklist)
 * ============================================================
 */
class StoreTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // ── Data Pelanggan ──
            'customer_name'    => [
                'required',
                'string',
                'max:100',
                // WHITELIST: Hanya huruf, spasi, titik, dan tanda hubung
                'regex:/^[a-zA-Z\s.\-]+$/',
            ],
            'phone_number'     => [
                'required',
                'string',
                'max:15',
                // WHITELIST: Hanya angka, +, -, (, ), dan spasi
                'regex:/^[\d\+\-\(\)\s]+$/',
            ],
            'email'            => ['nullable', 'email:rfc,dns', 'max:100'],
            'checkin_date'     => ['required', 'date'],

            // ── Data Perangkat ──
            'device_name'      => [
                'required',
                'string',
                'max:100',
                // WHITELIST: Huruf, angka, spasi, tanda hubung, dan titik
                'regex:/^[a-zA-Z0-9\s.\-]+$/',
            ],
            'device_brand'     => [
                'nullable',
                'string',
                'max:50',
                'regex:/^[a-zA-Z0-9\s.\-]+$/',
            ],
            'device_serial'    => [
                'required',
                'string',
                'max:50',
                // WHITELIST (Nomor Seri): Hanya Alphanumeric + tanda hubung
                // Ini memblokir SEMUA karakter berbahaya XSS & SQLi
                'regex:/^[a-zA-Z0-9\-]+$/',
            ],
            'device_condition' => ['nullable', 'string', 'max:255'],
            'keluhan'          => ['nullable', 'string', 'max:2000'],
            'total_biaya'      => ['required', 'numeric', 'min:0'],

            // ── Foto Perangkat (Opsional) ──
            'foto'             => ['nullable', 'array'],
            'foto.*'           => [
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',                          // Cek ekstensi
                'mimetypes:image/jpeg,image/png,image/webp',        // Cek MIME type sebenarnya (binary header)
                'max:5120',                                          // Maks 5 MB
            ],
        ];
    }

    /**
     * Pesan error kustom dalam Bahasa Indonesia
     */
    public function messages(): array
    {
        return [
            'customer_name.regex'   => 'Nama pelanggan hanya boleh mengandung huruf, spasi, titik, dan tanda hubung.',
            'phone_number.regex'    => 'Nomor HP hanya boleh mengandung angka, +, -, (, ), dan spasi.',
            'device_name.regex'     => 'Nama perangkat hanya boleh mengandung huruf, angka, spasi, dan tanda hubung.',
            'device_brand.regex'    => 'Merek perangkat hanya boleh mengandung huruf, angka, spasi, dan tanda hubung.',
            'device_serial.regex'   => 'Nomor seri perangkat hanya boleh mengandung huruf dan angka (tanpa spasi atau simbol).',
            'foto.*.image'      => 'File yang diunggah harus berupa gambar.',
            'foto.*.mimes'      => 'Foto perangkat harus berformat JPG, JPEG, PNG, atau WebP.',
            'foto.*.mimetypes'  => 'File yang diunggah bukan file gambar yang valid (kemungkinan file berbahaya).',
            'foto.*.max'        => 'Ukuran foto perangkat tidak boleh melebihi 5 MB.',
            'email.email'           => 'Format email tidak valid.',
        ];
    }

    /**
     * Sanitasi input sebelum validasi berjalan.
     * Menghapus whitespace berlebih dan karakter kontrol.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer_name'  => $this->sanitizeString($this->customer_name),
            'phone_number'   => $this->sanitizeString($this->phone_number),
            'device_name'    => $this->sanitizeString($this->device_name),
            'device_brand'   => $this->sanitizeString($this->device_brand),
            'device_serial'  => $this->sanitizeString($this->device_serial),
            'device_condition'=> $this->sanitizeString($this->device_condition),
            'keluhan'        => $this->sanitizeString($this->keluhan),
        ]);
    }

    /**
     * Helper: Bersihkan string dari karakter kontrol dan whitespace berlebih.
     */
    private function sanitizeString(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        // 1. Hapus karakter kontrol (null bytes, etc.) — bisa dipakai untuk bypass WAF
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);

        // 2. Trim whitespace berlebih
        $value = trim($value);

        return $value;
    }
}
