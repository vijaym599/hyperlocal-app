import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Gift, LogOut, MapPinned, MessageCircle, MessageSquareWarning, Phone, Save, ShieldCheck, Star, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ReferralRewards from './ReferralRewards';
import MyReports from './MyReports';
import ChangePhoneForm from './ChangePhoneForm';
import PasswordChangeForm from './PasswordChangeForm';

const activityIcon = { review: Star, call: Phone, directions: MapPinned, whatsapp: MessageCircle, view: Activity };
const activityLabel = { review: 'Reviewed', call: 'Called', directions: 'Opened directions to', whatsapp: 'Opened WhatsApp for', view: 'Viewed' };
const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
const date = (value) => value ? new Date(value).toLocaleString('en-IN') : '—';
const field = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function UserActivity({ session, onLogout, onSessionUpdate }) {
  const [section, setSection] = useState('overview'); const [account, setAccount] = useState(null); const [activities, setActivities] = useState([]);
  const [profile, setProfile] = useState({ owner_name: session.user?.owner_name || session.user?.name || '', email: session.user?.email || '' });
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const headers = { Authorization: `Bearer ${session.token}` };
      const [accountResponse, activityResponse] = await Promise.all([fetch(`${API_BASE_URL}/api/account`, { headers, signal }), fetch(`${API_BASE_URL}/api/activity`, { headers, signal })]);
      const accountResult = await accountResponse.json(); const activityResult = await activityResponse.json();
      if (!accountResponse.ok) throw new Error(accountResult.error || 'Unable to load your account.');
      if (!activityResponse.ok) throw new Error(activityResult.error || 'Unable to load your activity.');
      if (!signal.aborted) { setAccount(accountResult.account); setActivities(activityResult.activities || []); setProfile({ owner_name: accountResult.account.owner_name || '', email: accountResult.account.email || '' }); }
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [session.token]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  const request = async (path, options, key) => {
    setBusy(key); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...options?.headers } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to complete this action.'); return result;
    } catch (err) { setError(err.message); return null; } finally { setBusy(''); }
  };
  const saveProfile = async (event) => {
    event.preventDefault(); const result = await request('/api/account/profile', { method: 'PATCH', body: JSON.stringify(profile) }, 'profile');
    if (result) { const next = { ...session, user: { ...session.user, ...result.user } }; onSessionUpdate(next); setAccount((value) => ({ ...value, ...result.user })); setNotice('Profile updated successfully.'); }
  };
  const signOutAll = async () => {
    if (!window.confirm('Sign out this account on every device?')) return;
    const result = await request('/api/account/sign-out-all', { method: 'POST', body: '{}' }, 'signout');
    if (result) onLogout();
  };
  const nav = [{ id: 'overview', label: 'Overview', icon: UserRound }, { id: 'activity', label: 'Activity', icon: Clock3 }, { id: 'reports', label: 'My complaints', icon: MessageSquareWarning }, { id: 'rewards', label: 'Rewards', icon: Gift }, { id: 'security', label: 'Security', icon: ShieldCheck }];

  return <section className="mx-auto w-full max-w-[1500px] px-4 py-3 sm:px-8"><header className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">My account</p><h1 className="mt-2 text-3xl font-black">Welcome, {account?.owner_name || session.user?.owner_name || 'User'}</h1><p className="mt-2 text-sm text-slate-300">Manage your profile, activity, rewards and account security.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-bold"><CheckCircle2 className="h-4 w-4 text-emerald-300" />{account?.phone_verified ? 'Phone verified' : 'Verification pending'}</span></div></header>
    <nav className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{nav.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setSection(id); setError(''); setNotice(''); }} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${section === id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading && <p className="mt-8 text-sm text-slate-500">Loading your dashboard…</p>}
    {!loading && account && section === 'overview' && <><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[[Activity, 'Total activity', account.activity_count, 'emerald'], [Star, 'Reviews', account.review_count, 'amber'], [Phone, 'Contact actions', account.contact_action_count, 'sky'], [Gift, 'Reward balance', money(account.available_reward_paise), 'violet']].map(([Icon, label, value, tone]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className={`h-5 w-5 ${tone === 'amber' ? 'text-amber-600' : tone === 'sky' ? 'text-sky-600' : tone === 'violet' ? 'text-violet-600' : 'text-emerald-600'}`} /><p className="mt-3 text-2xl font-black text-slate-900">{value}</p><p className="text-xs font-semibold text-slate-500">{label}</p></article>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><form onSubmit={saveProfile} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-black">Profile details</h2><p className="mt-1 text-xs text-slate-500">Your phone is the unique account identity and cannot be edited here.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Name<input className={field} required minLength={2} maxLength={120} value={profile.owner_name} onChange={(e) => setProfile({ ...profile, owner_name: e.target.value })} autoComplete="name" /></label><label className="text-xs font-bold text-slate-600">Email (optional)<input className={field} type="email" maxLength={255} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} autoComplete="email" /></label></div><label className="mt-4 block text-xs font-bold text-slate-600">Verified phone<input className={`${field} cursor-not-allowed bg-slate-50 text-slate-500`} readOnly value={account.phone} /></label><button disabled={busy === 'profile'} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy === 'profile' ? 'Saving…' : 'Save profile'}</button></form><aside className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6"><ShieldCheck className="h-7 w-7 text-emerald-700" /><h2 className="mt-3 text-lg font-black text-emerald-950">Account protection</h2><ul className="mt-4 space-y-3 text-sm text-emerald-900"><li>✓ Phone number verified</li><li>✓ Password stored as a secure hash</li><li>✓ Account data available only after sign-in</li><li>✓ Password change signs out every device</li></ul><p className="mt-5 text-xs text-emerald-800">Member since {date(account.created_at)}</p></aside></div></>}
    {!loading && section === 'activity' && <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-black">My activity</h2><p className="mt-1 text-sm text-slate-500">Your recent shop views, calls, directions, WhatsApp actions and reviews.</p>{!activities.length && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No activity yet. Explore nearby shops to get started.</div>}<div className="mt-5 space-y-3">{activities.map((item) => { const Icon = activityIcon[item.action_type] || Clock3; const target = item.product_name || item.shop_name || item.details?.shop_name || 'a shop'; return <article key={item.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="h-fit rounded-lg bg-white p-2 text-emerald-700 shadow-sm"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800">{activityLabel[item.action_type] || 'Visited'} <span className="text-emerald-700">{target}</span></p>{item.action_type === 'review' && <p className="mt-0.5 text-xs text-slate-500">{item.details?.rating || 0} star rating</p>}<p className="mt-1 text-xs text-slate-400">{date(item.created_at)}</p></div></article>; })}</div></div>}
    {!loading && section === 'reports' && <div className="mt-5"><MyReports session={session} allowCreate /></div>}
    {!loading && section === 'rewards' && <div className="mt-6"><ReferralRewards session={session} /></div>}
    {!loading && account && section === 'security' && <div className="mt-5"><ChangePhoneForm session={session} currentPhone={account.phone} onChanged={onLogout} /></div>}
    {!loading && section === 'security' && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]"><PasswordChangeForm session={session} onChanged={onLogout} /><aside className="h-fit rounded-3xl border border-rose-200 bg-rose-50 p-5 sm:p-6"><LogOut className="h-6 w-6 text-rose-700" /><h2 className="mt-3 text-lg font-black text-rose-950">Sign out every device</h2><p className="mt-2 text-sm leading-6 text-rose-800">Use this if you lost a phone or think somebody else accessed your account. Every existing login will stop working.</p><button type="button" onClick={signOutAll} disabled={busy === 'signout'} className="mt-5 rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy === 'signout' ? 'Signing out…' : 'Sign out all devices'}</button><p className="mt-4 text-xs text-rose-700">Last password change: {account.password_changed_at ? date(account.password_changed_at) : 'Not changed yet'}</p></aside></div>}
  </section>;
}
