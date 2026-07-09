<?php

namespace App\Services;

use Cloudinary\Cloudinary;
use Cloudinary\Configuration\Configuration;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CloudinaryService
{
    protected ?Cloudinary $cloudinary = null;

    public function __construct()
    {
        $cloudName = env('CLOUDINARY_CLOUD_NAME');
        $apiKey    = env('CLOUDINARY_API_KEY');
        $apiSecret = env('CLOUDINARY_API_SECRET');

        // Hanya inisialisasi Cloudinary jika semua credentials tersedia
        if ($cloudName && $apiKey && $apiSecret) {
            $this->cloudinary = new Cloudinary(
                new Configuration([
                    'cloud' => [
                        'cloud_name' => $cloudName,
                        'api_key'    => $apiKey,
                        'api_secret' => $apiSecret,
                    ],
                    'url' => [
                        'secure' => true,
                    ],
                ])
            );
        }
    }

    /**
     * Upload file ke Cloudinary jika dikonfigurasi,
     * atau simpan ke local public storage sebagai fallback.
     */
    public function upload(string $filePath, string $folder = 'servitrack'): string
    {
        // Jika Cloudinary dikonfigurasi, gunakan Cloudinary
        if ($this->cloudinary) {
            $result = $this->cloudinary->uploadApi()->upload($filePath, [
                'folder'       => $folder,
                'quality'      => 'auto:good',
                'fetch_format' => 'auto',
            ]);

            return $result['secure_url'];
        }

        // Fallback: Simpan ke local public storage
        $extension = pathinfo($filePath, PATHINFO_EXTENSION) ?: 'jpg';
        $filename  = Str::uuid() . '.' . $extension;
        $localPath = $folder . '/' . $filename;

        Storage::disk('public')->put($localPath, file_get_contents($filePath));

        return Storage::disk('public')->url($localPath);
    }

    public function delete(string $publicId): void
    {
        if ($this->cloudinary) {
            $this->cloudinary->uploadApi()->destroy($publicId);
        }
        // Fallback local: tidak perlu hapus otomatis (bisa ditambahkan jika perlu)
    }
}