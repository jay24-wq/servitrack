<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DevicePhotoRequest extends FormRequest
{
    /**
     * Tentukan apakah user terotorisasi untuk melakukan request ini.
     */
    public function authorize(): bool
    {
        // Hanya user yang sudah login (auth) yang boleh mengunggah file
        return auth()->check();
    }

    /**
     * Aturan validasi untuk unggahan foto kondisi perangkat.
     */
    public function rules(): array
    {
        return [
            'device_photo' => [
                'required',
                'file',
                'image', // Memastikan file adalah gambar
                'mimes:jpeg,png,jpg,webp', // Membatasi ekstensi file gambar yang diperbolehkan
                'mimetypes:image/jpeg,image/png,image/webp', // 🔒 Cek MIME type asli (mencegah manipulasi ekstensi/eksekusi malware)
                'max:5120', // Membatasi ukuran file maksimal 5MB (5120 KB)
            ],
        ];
    }

    /**
     * Kustomisasi pesan kesalahan validasi.
     */
    public function messages(): array
    {
        return [
            'device_photo.required' => 'Foto kondisi perangkat wajib diunggah.',
            'device_photo.file' => 'Unggahan harus berupa file yang valid.',
            'device_photo.image' => 'File harus berupa gambar.',
            'device_photo.mimes' => 'Format file gambar yang diperbolehkan hanya JPEG, PNG, JPG, dan WebP.',
            'device_photo.mimetypes' => 'Tipe konten file tidak valid. Sistem mendeteksi file ini bukan gambar asli (potensi malware/web shell).',
            'device_photo.max' => 'Ukuran file foto maksimal adalah 5MB.',
        ];
    }
}
