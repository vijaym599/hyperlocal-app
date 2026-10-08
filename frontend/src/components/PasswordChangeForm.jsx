import { useState } from 'react';
import { KeyRound, Loader2, MessageCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function PasswordChangeForm({ session, onChanged, className = '' }) {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [code, setCode] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [step, setStep] = useState('passwords');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.token || ''}` },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to change password.');
    return data;
  };

  const sendCode = async (event) => {
    event.preventDefault(); setError('');
    if (form.new_password !== form.confirm_password) return setError('New passwords do not match.');
    setBusy(true);
    try {
      const data = await request('/api/account/password-verification/start', { current_password: form.current_password });
      setDevelopmentCode(data.development_code || '');
      setStep('code');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  const verifyAndChange = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const checked = await request('/api/account/password-verification/check', { code });
      const changed = await request('/api/account/password', {
        current_password: form.current_password,
        new_password: form.new_password,
        password_verification_token: checked.verification_token
      });
      window.alert(changed.message);
      onChanged?.();
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  return <form onSubmit={step === 'passwords' ? sendCode : verifyAndChange} className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    <KeyRound className="h-6 w-6 text-emerald-700" />
    <h2 className="mt-3 text-xl font-black text-slate-900">Change password</h2>
    <p className="mt-1 text-sm leading-6 text-slate-500">We verify the registered mobile number before changing the password. A successful change signs out every device.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {step === 'passwords' ? <>
      <label className="mt-5 block text-xs font-bold text-slate-600">Current password<input required type="password" autoComplete="current-password" maxLength={72} value={form.current_password} onChange={(event) => setForm({ ...form, current_password: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
      <label className="mt-4 block text-xs font-bold text-slate-600">New password<input required minLength={10} maxLength={72} type="password" autoComplete="new-password" value={form.new_password} onChange={(event) => setForm({ ...form, new_password: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
      <label className="mt-4 block text-xs font-bold text-slate-600">Confirm new password<input required minLength={10} maxLength={72} type="password" autoComplete="new-password" value={form.confirm_password} onChange={(event) => setForm({ ...form, confirm_password: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
      <p className="mt-3 text-xs text-slate-500">Use at least 10 characters with a letter and number.</p>
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}{busy ? 'Sending OTP…' : 'Send OTP'}</button>
    </> : <>
      <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">OTP sent to your registered mobile number.{developmentCode && <strong className="mt-2 block">Development OTP: {developmentCode}</strong>}</div>
      <label className="mt-4 block text-xs font-bold text-slate-600">SMS OTP<input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" minLength={4} maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-lg font-black tracking-[0.3em]" /></label>
      <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy || code.length < 4} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Changing…' : 'Verify OTP & change password'}</button><button type="button" disabled={busy} onClick={() => { setStep('passwords'); setCode(''); setDevelopmentCode(''); setError(''); }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-600">Edit details</button></div>
    </>}
  </form>;
}
