import { ArrowLeft, ArrowRight, Check, EnvelopeSimple, Eye, EyeSlash, LockKey, ShieldCheck, SquaresFour, Storefront, Wrench } from '@phosphor-icons/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore, homeForRole, DEMO_USERS, type DemoRole } from '../../store';
import { TENANT_SLUG } from '../../lib/api';
import { useLogin } from '../../hooks/useLogin';

const ROLE_OPTIONS: { value: DemoRole; label: string; hint: string; icon: typeof SquaresFour }[] = [
  { value: 'ADMIN', label: 'Admin', hint: 'Dashboard & operasional', icon: SquaresFour },
  { value: 'FRONTDESK', label: 'Frontdesk', hint: 'Check-in & kasir', icon: Storefront },
  { value: 'TEKNISI', label: 'Teknisi', hint: 'Pengerjaan unit', icon: Wrench },
];

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<DemoRole>('ADMIN');
  const [email, setEmail] = useState(DEMO_USERS.ADMIN.email);
  const [password, setPassword] = useState('servitrack');
  const [slug, setSlug] = useState(TENANT_SLUG);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const loginMutation = useLogin();

  if (user) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  const selectRole = (value: DemoRole) => {
    setRole(value);
    setEmail(DEMO_USERS[value].email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await loginMutation.mutateAsync({ email, password, slug });
      login(res.token);
      navigate(homeForRole(res.user.role), { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Gagal masuk. Periksa email/password/slug.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 flex relative overflow-hidden">
      
      {/* Split Background - Left (Dark with pattern) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-stone-950 via-slate-900 to-stone-950 items-center justify-center p-12">
        
        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }}></div>

        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl"></div>

        {/* Content */}
        <div className="relative z-10 max-w-lg space-y-8 reveal-up">
          <div className="inline-flex items-center gap-3 mb-8">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-sky-600/30 border border-slate-100">
              <img src="/logo.png" alt="ServiTrack Logo" className="w-12 h-12 object-contain contrast-125 saturate-150" />
            </div>
            <div>
              <span className="text-white text-3xl font-bold tracking-tight">ServiTrack</span>
              <p className="text-sky-400 text-sm font-medium">Professional Repair Platform</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-white text-4xl font-bold leading-tight tracking-tight">
              Transparansi penuh.<br/>
              Teknologi tanpa rahasia.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed">
              Akses panel teknisi dan staff untuk monitoring real-time, audit trail lengkap, dan kontrol operasional workshop.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
              <ShieldCheck size={24} className="text-sky-400 mb-2" weight="duotone" />
              <p className="text-white text-sm font-semibold">ISO 27001 Certified</p>
              <p className="text-slate-500 text-xs mt-1">Zero-access security</p>
            </div>
            <div className="p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
              <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center mb-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <p className="text-white text-sm font-semibold">Live Monitoring</p>
              <p className="text-slate-500 text-xs mt-1">Real-time telemetry</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right (Login Form) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white relative page-enter">
        
        {/* Mobile brand */}
        <div className="lg:hidden text-center mb-12 reveal-up">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-stone-100">
              <img src="/logo.png" alt="ServiTrack Logo" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-stone-900 text-2xl font-bold tracking-tight">ServiTrack</span>
          </div>
          <p className="text-slate-600 text-sm font-medium">Professional Repair Platform</p>
        </div>

        {/* Login Container */}
        <div className="w-full max-w-md reveal-up">
          
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight mb-3">Selamat Datang</h1>
            <p className="text-slate-600 text-lg leading-relaxed">Masuk untuk mengakses dashboard teknisi & staff ServiTrack.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7">

            {/* Tenant Slug */}
            <div className="group">
              <label className="text-sm font-semibold text-stone-800 mb-2 block tracking-wide">Tenant Slug</label>
              <div className="relative">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="demo"
                  required
                  className="w-full px-4 py-4 bg-white border-2 border-stone-200 rounded-2xl text-base text-stone-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition"
                />
              </div>
            </div>

            {/* Role Selector */}
            <div>
              <label className="text-sm font-semibold text-stone-800 mb-2 block tracking-wide">Masuk sebagai (cepat isi email)</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {ROLE_OPTIONS.map((option) => {
                  const RoleIcon = option.icon;
                  const active = role === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectRole(option.value)}
                      aria-pressed={active}
                      className={`flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3.5 text-left transition-all ${
                        active
                          ? 'border-sky-500 bg-sky-50/60 ring-4 ring-sky-100'
                          : 'border-stone-200 bg-white hover:border-sky-200 hover:bg-stone-50'
                      }`}
                    >
                      <span className={`flex size-8 items-center justify-center rounded-lg ${active ? 'bg-sky-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
                        <RoleIcon weight="fill" size={18} />
                      </span>
                      <span className="text-sm font-bold text-stone-900">{option.label}</span>
                      <span className="text-[11px] leading-tight text-slate-500">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email Input */}
            <div className="group">
              <label className="text-sm font-semibold text-stone-800 mb-2 block tracking-wide">Email</label>
              <div className="relative transition-all group-focus-within:scale-[1.01]">
                <EnvelopeSimple className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-600 transition" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@servitrack.com"
                  required
                  className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-200 rounded-2xl text-base text-stone-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="group">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-stone-800 tracking-wide">Password</label>
                <a href="#" className="text-xs text-sky-600 hover:text-sky-800 font-medium hover:underline">Lupa password?</a>
              </div>
              <div className="relative transition-all group-focus-within:scale-[1.01]">
                <LockKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-sky-600 transition" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="no-password-reveal w-full pl-12 pr-12 py-4 bg-white border-2 border-stone-200 rounded-2xl text-base text-stone-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition placeholder:text-slate-400 placeholder:tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-stone-700 transition p-1 rounded-full hover:bg-stone-100"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input 
                  type="checkbox" 
                  id="remember" 
                  className="peer hidden" 
                />
                <label 
                  htmlFor="remember" 
                  className="w-5 h-5 border-2 border-stone-300 rounded-md flex items-center justify-center cursor-pointer transition peer-checked:bg-sky-600 peer-checked:border-sky-600"
                >
                  <Check size={12} weight="bold" className="text-white opacity-0 peer-checked:opacity-100 transition" />
                </label>
              </div>
              <label htmlFor="remember" className="text-sm text-stone-700 cursor-pointer select-none">Ingat saya di perangkat ini</label>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-3 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{loginMutation.isPending ? 'Memproses...' : 'Masuk ke Dashboard'}</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" weight="bold" />
            </button>

          </form>

          {/* Divider */}
          <div className="relative my-8">
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
              className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 text-sm font-medium group transition"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Kembali ke beranda publik
            </a>
          </div>

        </div>

        {/* Mobile Footer - below public link */}
        <div className="lg:hidden mt-6 pt-6 border-t border-stone-100 text-center space-y-3">
          <p className="text-slate-500 text-sm">
            Belum punya akses? Hubungi admin untuk registrasi staff.
          </p>
          <div className="flex justify-center gap-4 text-xs text-slate-500">
            <a href="#" className="hover:text-stone-900 transition hover:underline">Syarat & Ketentuan</a>
            <span>•</span>
            <a href="#" className="hover:text-stone-900 transition hover:underline">Kebijakan Privasi</a>
            <span>•</span>
            <a href="#" className="hover:text-stone-900 transition hover:underline">Security Policy</a>
          </div>
        </div>

      </div>
    </div>
  );
}
