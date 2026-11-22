import { ArrowLeft, ArrowRight, Check, EnvelopeSimple, Eye, EyeSlash, LockKey } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore, homeForRole } from '../../store';
import type { LoginPortal } from '../../lib/api';
import { useLogin } from '../../hooks/useLogin';

export default function LoginPage({ portal = 'admin' }: { portal?: LoginPortal }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const loginMutation = useLogin();

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await loginMutation.mutateAsync({ email, password, portal });
      login(res.token);
      navigate(homeForRole(res.user.role), { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Gagal masuk. Periksa kembali email dan password Anda.');
    }
  };

  return (
    <div className="min-h-dvh bg-stone-950 flex relative overflow-hidden">

      {/* Split Background - Left (Image) */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-stone-950">
        <img
          src={portal === 'admin' ? '/admin.webp' : '/staff.webp'}
          alt={portal === 'admin' ? 'ServiTrack Admin Portal' : 'ServiTrack Staff Portal'}
          className="absolute inset-0 w-full h-full object-cover object-[30%_50%]"
        />

        {/* Overlay gelap di bagian atas supaya logo dan teks terbaca */}
        <div className="absolute inset-0 bg-gradient-to-b from-stone-950/70 via-transparent to-transparent"></div>

        {/* Logo + Brand (pojok kiri atas) */}
        <div className="absolute top-8 left-8 z-10 inline-flex items-center gap-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center">
            <img src="/logos.webp" alt="ServiTrack Logo" className="w-9 h-9 object-contain contrast-125 saturate-150" />
          </div>
          <span className="text-white text-2xl font-bold tracking-tight drop-shadow-md">ServiTrack</span>
        </div>
      </div>

      {/* Right (Login Form).
          flex-col supaya identitas workshop, form, dan footer mobile tersusun ke bawah
          (sebelumnya flex-row, jadi ketiganya berjejer menyamping di HP). */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-5 py-8 sm:p-6 lg:p-12 bg-white relative page-enter">

        {/* Identitas workshop pada mobile */}
        <div className="lg:hidden text-center mb-8 reveal-up">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-stone-100">
              <img src="/logos.webp" alt="ServiTrack Logo" className="w-9 h-9 object-contain" />
            </div>
            <span className="text-stone-900 text-2xl font-bold tracking-tight">ServiTrack</span>
          </div>
          <p className="text-slate-600 text-sm font-medium">Professional Repair Platform</p>
        </div>

        {/* Login Container */}
        <div className="w-full max-w-md reveal-up">

          <div className="mb-7 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight mb-2 sm:mb-3">
              {portal === 'admin' ? 'Selamat Datang Kembali' : 'Selamat Datang'}
            </h1>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
              {portal === 'admin'
                ? 'Masuk ke dashboard ServiTrack Anda'
                : 'Masuk dengan akun staff anda'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-7">

            {/* Email Input */}
            <div className="group">
              <label htmlFor="email" className="text-sm font-semibold text-stone-800 mb-2 block tracking-wide">Email</label>
              <div className="relative transition-all group-focus-within:scale-[1.01]">
                <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-600 transition" size={20} />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@gmail.com"
                  required
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-white border-2 border-stone-200 rounded-2xl text-base text-stone-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition placeholder:text-slate-400"
                />
              </div>
              {portal === 'staff' && (
                <p id="email-hint" className="mt-2 text-xs text-slate-500">
                  Email yang diberikan oleh Admin
                </p>
              )}
            </div>

            {/* Password Input */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="text-sm font-semibold text-stone-800 tracking-wide">Password</label>
                <a href="#" className="text-xs text-sky-600 hover:text-sky-800 font-medium hover:underline py-1">Lupa password?</a>
              </div>
              <div className="relative transition-all group-focus-within:scale-[1.01]">
                <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-600 transition" size={20} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="no-password-reveal w-full pl-12 pr-12 py-3.5 sm:py-4 bg-white border-2 border-stone-200 rounded-2xl text-base text-stone-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition placeholder:text-slate-400 placeholder:tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-stone-700 transition p-2 rounded-full hover:bg-stone-100"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me.
                Input memakai sr-only (bukan hidden) supaya tetap bisa difokus keyboard,
                dan ikon centang dikendalikan lewat peer-checked:[&>svg] karena ikon
                berada di dalam label, bukan sibling dari input. */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  id="remember"
                  className="peer sr-only"
                />
                <label
                  htmlFor="remember"
                  className="w-5 h-5 border-2 border-stone-300 rounded-md flex items-center justify-center cursor-pointer transition peer-checked:bg-sky-600 peer-checked:border-sky-600 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300 peer-checked:[&>svg]:opacity-100"
                >
                  <Check size={12} weight="bold" className="text-white opacity-0 transition" />
                </label>
              </div>
              <label htmlFor="remember" className="text-sm text-stone-700 cursor-pointer select-none py-1">Ingat saya di perangkat ini</label>
            </div>

            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{loginMutation.isPending ? 'Memproses...' : portal === 'admin' ? 'Masuk ke Dashboard' : 'Masuk sebagai Staff'}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" weight="bold" />
            </button>

          </form>

          <div className="mt-5 space-y-2 text-center text-sm">
            {portal === 'admin' && (
              <p className="text-slate-500">
                Belum punya akun?{' '}
                <Link to="/register" className="font-semibold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-sm">
                  Daftar sekarang
                </Link>
              </p>
            )}
            <Link
              to={portal === 'admin' ? '/staff/login' : '/login'}
              className="inline-flex min-h-10 items-center justify-center py-1 font-semibold text-sky-700 underline-offset-4 hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-sm"
            >
              {portal === 'admin' ? 'Login sebagai Staff' : 'Login sebagai Admin'}
            </Link>
          </div>

          {/* Divider */}
          <div className="relative my-6 sm:my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-stone-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-stone-500 text-sm">Atau</span>
            </div>
          </div>

          {/* Public Access Link */}
          <div className="text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 py-2 text-stone-600 hover:text-stone-900 text-sm font-medium group transition"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Kembali ke beranda publik
            </a>
          </div>

        </div>

        {/* Mobile Footer - below public link */}
        <div className="lg:hidden w-full max-w-md mt-6 pt-6 border-t border-stone-100 text-center space-y-3">
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <a href="#" className="hover:text-stone-900 transition hover:underline">Syarat & Ketentuan</a>
            <span aria-hidden="true">•</span>
            <a href="#" className="hover:text-stone-900 transition hover:underline">Kebijakan Privasi</a>
            <span aria-hidden="true">•</span>
            <a href="#" className="hover:text-stone-900 transition hover:underline">Security Policy</a>
          </div>
        </div>

      </div>
    </div>
  );
}
