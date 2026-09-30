import { useState } from 'react';
import { ArrowLeft, Loader2, LogIn, UserPlus } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function CustomerAuth({ onLoginSuccess, onChooseShop, onBack }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const endpoint = mode === 'customer-register' ? 'register-customer' : 'login';
      const payload = mode === 'customer-register' ? form : { email: form.email, password: form.password };
      const response = await fetch(`${API_BASE_URL}/api/auth/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
      onLoginSuccess({ token: data.token, user: { ...data.user, name: data.user.owner_name }, shop: data.shop || null });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return <div className="mx-auto my-10 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
    <button onClick={onBack} className="mb-5 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Back to explore</button>
    <h1 className="text-2xl font-bold text-slate-800">{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
    <p className="mt-1 text-sm text-slate-500">Your account type controls the features you can access.</p>
    {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {mode === 'register' && <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3 text-left" onClick={() => setMode('customer-register')}><span className="block text-sm font-bold text-emerald-800">Customer</span><span className="mt-1 block text-xs text-slate-500">Discover, review and save activity</span></button><button type="button" className="rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400" onClick={onChooseShop}><span className="block text-sm font-bold text-slate-800">Shop owner</span><span className="mt-1 block text-xs text-slate-500">List products with a subscription</span></button></div>}
    {mode !== 'register' && <form onSubmit={submit} className="mt-5 space-y-4">
      {mode === 'customer-register' && <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />}
      <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <input required minLength={mode === 'customer-register' ? 8 : undefined} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
      <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}{mode === 'login' ? 'Sign in' : 'Create customer account'}</button>
    </form>}
    <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="mt-5 w-full text-xs font-semibold text-emerald-700 hover:underline">{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
  </div>;
}
