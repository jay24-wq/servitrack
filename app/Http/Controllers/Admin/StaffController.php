<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;

class StaffController extends Controller
{
    public function index(Request $request)
    {
        $query = User::latest();

        if ($request->role && $request->role !== 'semua') {
            $query->where('role', $request->role);
        }

        if ($request->sort === 'name_desc') {
            $query->orderBy('name', 'desc');
        } else {
            $query->orderBy('name', 'asc');
        }

        $users = $query->paginate(10)->withQueryString();

        $stats = [
            'total_admin'     => User::where('role', 'admin')->count(),
            'total_teknisi'   => User::where('role', 'teknisi')->count(),
            'total_frontdesk' => User::where('role', 'frontdesk')->count(),
            'total_aktif'     => User::where('is_active', true)->count(),
        ];

        return view('admin.staff', compact('users', 'stats'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users,email',
            'phone'    => 'nullable|string|max:20',
            'role'     => 'required|in:admin,teknisi,frontdesk',
            'password' => 'required|string|min:8|confirmed',
        ]);

        User::create([
            'name'      => $request->name,
            'email'     => $request->email,
            'phone'     => $request->phone,
            'role'      => $request->role,
            'password'  => Hash::make($request->password),
            'is_active' => true,
        ]);

        return back()->with('success', 'Staff ' . $request->name . ' berhasil ditambahkan!');
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name'  => 'required|string|max:100',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'role'  => 'required|in:admin,teknisi,frontdesk',
        ]);

        $data = [
            'name'  => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'role'  => $request->role,
        ];

        if ($request->filled('password')) {
            $request->validate(['password' => 'min:8|confirmed']);
            $data['password'] = Hash::make($request->password);
        }

        $user->update($data);

        return back()->with('success', 'Data staff ' . $user->name . ' berhasil diperbarui!');
    }

    public function toggleActive(User $user)
    {
        if ($user->id === auth::id()) {
            return back()->with('error', 'Tidak bisa menonaktifkan akun sendiri!');
        }

        $user->update(['is_active' => !$user->is_active]);

        $status = $user->is_active ? 'diaktifkan' : 'dinonaktifkan';
        return back()->with('success', 'Akun ' . $user->name . ' berhasil ' . $status . '!');
    }
}