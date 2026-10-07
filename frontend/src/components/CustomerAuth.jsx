import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import PhoneVerification from './PhoneVerification';
import ForgotPassword from './ForgotPassword';
import LoginVerification from './LoginVerification';
import IndianPhoneInput from './IndianPhoneInput';
import { indianPhoneE164 } from '../phone.mjs';

export default function CustomerAuth({ onLoginSuccess, onChooseShop, onBack }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');
  const [loginChallenge, setLoginChallenge] = useState(null);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const endpoint = mode === 'customer-register' ? 'register-customer' : 'login';
      const phone = indianPhoneE164(form.phone);
      const payload = mode === 'customer-register' ? { ...form, phone, phone_verification_token: phoneVerificationToken } : { phone, password: form.password };
      const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
      if (mode === 'login' && data.requires_otp) { setLoginChallenge(data); return; }
      onLoginSuccess({ token: data.token, user: { ...data.user, name: data.user.owner_name }, shop: data.shop || null });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (mode === 'forgot') return <div className="mx-3 my-3 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mx-auto sm:my-10 sm:p-7"><ForgotPassword initialPhone={form.phone} onBack={() => setMode('login')} onComplete={(phone) => { setForm({ ...form, phone, password: '' }); setResetNotice('Password reset successfully. Sign in with your new password.'); setMode('login'); }} /></div>;
  if (loginChallenge) return <div className="mx-3 my-3 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mx-auto sm:my-10 sm:p-7"><LoginVerification phone={indianPhoneE164(form.phone)} challenge={loginChallenge} onBack={() => setLoginChallenge(null)} onVerified={(data) => onLoginSuccess({ token: data.token, user: { ...data.user, name: data.user.owner_name }, shop: data.shop || null })} /></div>;

  return <div className="mx-3 my-3 max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mx-auto sm:my-10 sm:p-7">
    <button onClick={onBack} className="mb-5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Back to explore</button>
    <h1 className="text-2xl font-bold text-slate-800">{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
    <p className="mt-1 text-sm text-slate-500">Use your phone number and password to access your account.</p>
    {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {resetNotice && <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">{resetNotice}</p>}
    {mode === 'register' && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3 text-left" onClick={() => setMode('customer-register')}><span className="block text-sm font-bold text-emerald-800">Customer</span><span className="mt-1 block text-xs text-slate-500">Discover, review and save activity</span></button><button type="button" className="rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400" onClick={onChooseShop}><span className="block text-sm font-bold text-slate-800">Shop owner</span><span className="mt-1 block text-xs text-slate-500">List products with a subscription</span></button></div>}
    {mode !== 'register' && <form onSubmit={submit} className="mt-5 space-y-4">
      {mode === 'customer-register' && <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />}
      <IndianPhoneInput value={form.phone} onChange={(phone) => { setForm({ ...form, phone }); setPhoneVerificationToken(''); }} label="Account mobile number" />
      {mode === 'customer-register' && <PhoneVerification key={form.phone} phone={indianPhoneE164(form.phone)} verified={Boolean(phoneVerificationToken)} onVerified={setPhoneVerificationToken} />}
      {mode === 'customer-register' && <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address (optional)" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />}
      <div className="relative"><input required minLength={mode === 'customer-register' ? 10 : undefined} maxLength={72} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'customer-register' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'customer-register' ? 'Password (10+ characters, letter & number)' : 'Password'} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-11 text-sm" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      {mode === 'login' && <button type="button" onClick={() => { setError(''); setResetNotice(''); setMode('forgot'); }} className="-mt-1 text-left text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</button>}
      <button disabled={loading || (mode === 'customer-register' && !phoneVerificationToken)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{mode === 'login' ? 'Sign in' : 'Create customer account'}</button>
    </form>}
    <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setResetNotice(''); setPhoneVerificationToken(''); setLoginChallenge(null); }} className="mt-5 w-full text-xs font-semibold text-emerald-700 hover:underline">{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
  </div>;
}
