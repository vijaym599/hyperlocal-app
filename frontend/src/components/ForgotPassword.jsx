import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, MessageCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { readApiResponse } from '../apiResponse.mjs';
import { indianPhoneE164 } from '../phone.mjs';
import IndianPhoneInput from './IndianPhoneInput';

export default function ForgotPassword({ initialPhone = '', onBack, onComplete }) {
  const [phone, setPhone] = useState(initialPhone);
  const [step, setStep] = useState('phone');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState({ next: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const call = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return readApiResponse(response);
  };

  const sendCode = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await call('start', { phone: indianPhoneE164(phone) });
      setStep('code');
      setMessage(result.development_code ? `Development OTP: ${result.development_code}` : result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const result = await call('check', { phone: indianPhoneE164(phone), code });
      setResetToken(result.reset_token);
      setStep('password');
      setMessage('Phone verified. Create a new password.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (password.next !== password.confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      const result = await call('complete', { phone: indianPhoneE164(phone), reset_token: resetToken, new_password: password.next });
      setStep('done'); setMessage(result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  if (step === 'done') return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" /><h3 className="mt-3 text-lg font-black text-emerald-950">Password reset complete</h3><p className="mt-2 text-sm leading-6 text-emerald-800">{message}</p><button type="button" onClick={() => onComplete?.(phone)} className="mt-5 w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">Back to sign in</button></div>;

  return <div>
    <button type="button" onClick={onBack} className="mb-5 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Back to sign in</button>
    <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><KeyRound className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-slate-900">Reset password</h2><p className="mt-0.5 text-xs text-slate-500">For customers and shop owners</p></div></div>
    <p className="mt-4 text-sm leading-6 text-slate-600">We will verify the mobile number registered to your account by SMS before allowing a new password.</p>
    {message && <p role="status" className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">{message}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}

    {step === 'phone' && <form onSubmit={sendCode} className="mt-5 space-y-4"><IndianPhoneInput value={phone} onChange={setPhone} label="Registered mobile number" /><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}Send SMS OTP</button></form>}

    {step === 'code' && <form onSubmit={verifyCode} className="mt-5 space-y-4"><label className="block text-xs font-bold text-slate-600">SMS OTP<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" minLength={4} maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter the SMS OTP sent to your mobile" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><button disabled={busy || code.length < 4} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Verify code</button><button type="button" disabled={busy} onClick={() => { setStep('phone'); setCode(''); setMessage(''); setError(''); }} className="w-full text-xs font-bold text-emerald-700">Use a different number</button></form>}

    {step === 'password' && <form onSubmit={resetPassword} className="mt-5 space-y-4"><label className="block text-xs font-bold text-slate-600">New password<div className="relative mt-2"><input required minLength={10} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 pr-11 text-sm" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label><label className="block text-xs font-bold text-slate-600">Confirm new password<input required minLength={10} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><p className="text-xs leading-5 text-slate-500">Use at least 10 characters with a letter and number. Resetting signs out every existing device.</p><button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Set new password</button></form>}
  </div>;
}
