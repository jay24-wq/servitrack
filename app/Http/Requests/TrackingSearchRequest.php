<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * ============================================================
 * FORM REQUEST: TrackingSearchRequest
 * ============================================================
 * Validasi Whitelist untuk pencarian resi publik.
 * 
 * KEAMANAN:
 * - Hanya menerima format kode resi: huruf, angka, dan tanda hubung
 * - Contoh format valid: SRV-20240610-A1B2C3D4
 * - Memblokir SEMUA karakter XSS (<script>, dll)
 * - Memblokir SEMUA karakter SQLi (', ", ;, --, dll)
 * ============================================================
 */
class TrackingSearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'kode_servis' => [
                'required',
                'string',
                'max:30',
                // WHITELIST: Hanya huruf kapital, angka, dan tanda hubung
                // Format: SRV-YYYYMMDD-XXXXXXXX
                'regex:/^[A-Za-z0-9\-]+$/',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'kode_servis.required' => 'Nomor tiket/resi tidak boleh kosong!',
            'kode_servis.regex'    => 'Format nomor resi tidak valid. Mohon hindari karakter khusus atau berbahaya.',
            'kode_servis.max'      => 'Nomor resi terlalu panjang (maksimal 30 karakter).',
        ];
    }

    /**
     * Sanitasi dan normalisasi input sebelum validasi
     */
    protected function prepareForValidation(): void
    {
        if ($this->kode_servis) {
            $this->merge([
                // Trim + uppercase untuk normalisasi
                'kode_servis' => strtoupper(trim($this->kode_servis)),
            ]);
        }
    }
}
