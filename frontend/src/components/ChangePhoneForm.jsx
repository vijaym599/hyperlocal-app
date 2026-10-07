import { useMemo, useState } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { indianPhoneE164 } from '../phone.mjs';
import IndianPhoneInput from './IndianPhoneInput';
import PhoneVerification from './PhoneVerification';

export default function ChangePhoneForm({ session, currentPhone, onChanged, compact = false }) {
  const [newPhone, setNewPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const phone = useMemo(() => indianPhoneE164(newPhone), [newPhone]);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/account/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ new_phone: phone, current_password: currentPassword, phone_verification_token: verificationToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to change the mobile number.');
      window.alert(data.message);
      onChanged?.();
    } catch (submitError) { setError(submitError.message); }
    finally { setBusy(false); }
  };

  return <form onSubmit={submit} className={`rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm ${compact ? 'sm:p-5' : 'sm:p-6'}`}>
    <Smartphone className="h-6 w-6 text-sky-700" />
    <h2 className="mt-3 text-xl font-black text-slate-900">Change mobile number</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">Current number: <strong>{currentPhone || 'Not available'}</strong>. Verify the new number and confirm your password.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    <div className="mt-5"><IndianPhoneInput value={newPhone} onChange={(value) => { setNewPhone(value); setVerificationToken(''); }} label="New mobile number" /></div>
    <div className="mt-3"><PhoneVerification key={phone} phone={phone} verified={Boolean(verificationToken)} onVerified={setVerificationToken} /></div>
    <label className="mt-4 block text-xs font-bold text-slate-600">Current password<input required type="password" maxLength={72} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm" /></label>
    <p className="mt-3 text-xs leading-5 text-sky-800">After the change, every device will be signed out. Another phone change is blocked for 30 days.</p>
    <button disabled={busy || !verificationToken || phone === currentPhone} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Changing...' : 'Change number & sign out'}</button>
  </form>;
}
