<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Membuat Akun Admin Utama
        User::create([
            'name' => 'Admin ServiTrack',
            'email' => 'admin@servitrack.com',
            'password' => Hash::make('password123'), // Ganti dengan password aman Anda
            'role' => 'admin',
        ]);

        // 2. Membuat Akun Teknisi 1
        User::create([
            'name' => 'Budi Hardware Engineer',
            'email' => 'budi@servitrack.com',
            'password' => Hash::make('password123'),
            'role' => 'teknisi',
        ]);

        // 3. Membuat Akun Teknisi 2
        User::create([
            'name' => 'Andi Master Technician',
            'email' => 'andi@servitrack.com',
            'password' => Hash::make('password123'),
            'role' => 'teknisi',
        ]);
    }
}
