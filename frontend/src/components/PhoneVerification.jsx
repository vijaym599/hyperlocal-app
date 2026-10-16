import { useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { readApiResponse } from '../apiResponse.mjs';

export default function PhoneVerification({ phone, verified, onVerified }) {
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const call = async (path, body) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/phone-verification/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return readApiResponse(response);
  };
  const send = async () => {
    if (busy) return;
    setBusy(true); setError(''); setMessage(''); onVerified('');
    try {
      const result = await call('start', { phone });
      setSent(true); setMessage(result.development_code ? `Development OTP: ${result.development_code}` : result.message);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const check = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await call('check', { phone, code });
      onVerified(result.verification_token); setMessage('Mobile number verified by SMS.');
    } catch (err) { onVerified(''); setError(err.message); }
    finally { setBusy(false); }
  };
  if (verified) return <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />Mobile number verified by SMS</div>;
  return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900"><MessageCircle className="h-4 w-4" />Verify account phone by SMS</p><p className="mt-1 text-[11px] text-slate-600">OTP will be sent by SMS to this +91 mobile number.</p></div><button type="button" disabled={busy || !/^\+91[6-9]\d{9}$/.test(phone)} onClick={send} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? 'Resend code' : 'Send OTP'}</button></div>
    {sent && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="SMS OTP" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4,10}" minLength={4} maxLength={10} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Enter the SMS OTP sent to this mobile" className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" /><button type="button" disabled={busy || code.length < 4} onClick={check} className="min-h-10 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 sm:w-auto">Verify</button></div>}
    {message && <p role="status" className="mt-2 text-xs text-emerald-700">{message}</p>}{error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </div>;
}
