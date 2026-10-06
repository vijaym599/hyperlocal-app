import { useState } from 'react';
import { ArrowLeft, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { readApiResponse } from '../apiResponse.mjs';

export default function LoginVerification({ phone, challenge, onBack, onVerified }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, login_token: challenge.login_token })
      });
      onVerified(await readApiResponse(response));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <div>
    <button type="button" onClick={onBack} className="mb-5 flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" />Back to password</button>
    <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-slate-900">Two-step verification</h2><p className="mt-0.5 text-xs text-slate-500">Password verified</p></div></div>
    <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="flex items-center gap-2 text-sm font-bold text-sky-900"><Smartphone className="h-4 w-4" />Enter the SMS OTP</p><p className="mt-1 text-xs leading-5 text-sky-700">A code was sent to the mobile number registered to this account. It expires in 10 minutes.</p>{challenge.development_code && <p className="mt-2 text-xs font-black text-sky-900">Development OTP: {challenge.development_code}</p>}</div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-xs font-bold text-slate-600">SMS verification code<input required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" minLength={4} maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter OTP" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-lg font-black tracking-[0.35em]" /></label><button disabled={busy || code.length < 4} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Verifying…' : 'Verify & sign in'}</button></form>
    <p className="mt-4 text-center text-xs leading-5 text-slate-500">Didn’t receive the code? Go back and submit your password again after one minute.</p>
  </div>;
}
