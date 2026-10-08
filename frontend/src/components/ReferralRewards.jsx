import { useCallback, useEffect, useState } from 'react';
import { Copy, Gift, RefreshCw, Share2, Wallet } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { formatMoney, referralLink, referralStatus } from '../referrals.mjs';

const date = (value) => new Date(value).toLocaleString('en-IN');
const style = (status) => ['available', 'paid'].includes(status) ? 'bg-emerald-100 text-emerald-800' : status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800';
const field = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm';

export default function ReferralRewards({ session }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('referrals');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ account_name: session.user?.owner_name || '', upi_id: '' });
  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/referrals`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load rewards.');
      if (!signal?.aborted) setData(result);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [session.token]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);
  const link = data ? referralLink(window.location.origin, data.user.referral_code) : '';
  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); setNotice('Copied. Share it with the shop owner before they register.'); }
    catch { setError('Select and copy your referral link below. Automatic copy is unavailable.'); }
  };
  const share = async () => {
    if (!navigator.share) return copy(link);
    try { await navigator.share({ title: 'Join Nearbuy', text: 'Register your shop on Nearbuy using my referral link.', url: link }); }
    catch (err) { if (err.name !== 'AbortError') setError('Could not share. Copy the link instead.'); }
  };
  const redeem = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/referrals/redeem`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit redemption.');
      setNotice(`Redemption #${result.redemption.id} submitted for admin approval.`); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const balance = data?.wallet || {};
  const open = data?.redemptions.find((item) => ['pending', 'approved'].includes(item.status));
  return <div className="mb-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Your referral wallet</p><h1 className="mt-2 text-3xl font-black text-slate-900">Refer a shop. Earn rewards.</h1><p className="mt-2 text-sm text-slate-500">Earn 20% of the first subscription price when your referred shop joins Nearbuy.</p></div><button type="button" disabled={loading || busy} onClick={() => load()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></header>
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {loading && !data && <p className="mt-6 text-sm text-slate-500">Loading referral rewards…</p>}
    {data && <>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Available to redeem', balance.available_paise], ['Payment review pending', balance.unverified_paise], ['Redemption in progress', balance.reserved_paise], ['Paid to you', balance.paid_paise]].map(([label, amount]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-emerald-700">{formatMoney(amount)}</p></div>)}</div>
      <nav aria-label="Referral sections" className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">{[['referrals', 'Referred shops'], ['redeem', 'Redeem & payouts']].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}>{label}</button>)}</nav>
      {tab === 'referrals' && <>
        <section className="mt-4 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-7"><Gift className="h-7 w-7 text-emerald-700" /><h2 className="mt-3 text-xl font-black">Share your invitation</h2><p className="mt-2 text-sm text-slate-600">The owner must use your code when registering. Your reward becomes available after the first subscription payment is checked. Renewals and plan changes do not earn another reward.</p><div className="mt-4 flex flex-wrap items-center gap-3"><span className="break-all rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-sm font-bold text-emerald-800">{data.user.referral_code}</span><button type="button" onClick={() => copy(data.user.referral_code)} className="text-sm font-bold text-emerald-700">Copy code</button></div><label className="mt-4 block text-xs font-semibold">Invitation link<input className={field} readOnly value={link} onFocus={(event) => event.target.select()} /></label><div className="mt-4 flex gap-3"><button type="button" onClick={() => copy(link)} className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"><Copy className="h-4 w-4" />Copy link</button><button type="button" onClick={share} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700"><Share2 className="h-4 w-4" />Share</button></div><p className="mt-4 text-xs text-slate-500">₹199 Pro plan → ₹39.80 reward, credited once.</p></section>
        <h2 className="mt-6 text-lg font-bold">Your referred shops ({data.earnings.length})</h2>{!data.earnings.length && <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">No shops referred yet. Share your link to get started.</p>}
        <div className="mt-3 space-y-3">{data.earnings.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-bold">{item.shop_name}</h3><p className="mt-1 text-xs text-slate-500">Shop #{item.referred_shop_id} · <span className="capitalize">{item.subscription_plan}</span> · {formatMoney(item.subscription_price_paise)}</p></div><div className="text-right"><p className="font-black text-emerald-700">+{formatMoney(item.reward_paise)}</p><span className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold ${style(item.status)}`}>{referralStatus[item.status]}</span></div></div><p className="mt-3 text-xs text-slate-400">Referred {date(item.created_at)}</p>{item.review_note && <p className="mt-2 text-sm text-slate-600">Admin note: {item.review_note}</p>}</article>)}</div>
      </>}
      {tab === 'redeem' && <>
        <form onSubmit={redeem} className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-7"><Wallet className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 text-xl font-black">Redeem your rewards</h2><p className="mt-2 text-sm text-slate-600">Submit your available balance for admin approval.</p><p className="mt-3 text-sm font-semibold">Account phone: {data.user.phone || 'Not set'} <span className="font-normal text-slate-500">· {data.user.phone_verified ? 'Verified' : 'Not phone-verified'}</span></p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Account holder name<input className={field} required minLength={2} maxLength={120} value={form.account_name} onChange={(event) => setForm({ ...form, account_name: event.target.value })} /></label><label className="text-xs font-bold text-slate-600">Payout UPI ID<input className={field} required maxLength={150} placeholder="Enter payout UPI ID, e.g. yourname@bank" value={form.upi_id} onChange={(event) => setForm({ ...form, upi_id: event.target.value })} /></label></div><button disabled={busy || loading || balance.available_paise <= 0 || Boolean(open)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Submitting…' : `Redeem ${formatMoney(balance.available_paise)}`}</button>{open ? <p className="mt-3 text-sm text-amber-700">Request #{open.id}: {referralStatus[open.status]}.</p> : balance.available_paise <= 0 && <p className="mt-3 text-sm text-slate-500">Your reward must be verified before you can redeem.</p>}<p className="mt-3 text-xs text-slate-500">Approval reserves the amount for payout. Paid appears only after the transfer is confirmed. A rejected request returns the amount to your available balance.</p></form>
        <h2 className="mt-6 text-lg font-bold">Redemption history</h2>{!data.redemptions.length && <p className="mt-3 text-sm text-slate-500">No redemption requests yet.</p>}
        <div className="mt-3 space-y-3">{data.redemptions.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">Request #{item.id} · {formatMoney(item.amount_paise)}</p><p className="mt-1 text-xs text-slate-500">{item.account_name} · {item.upi_id}</p></div><span className={`h-fit rounded-full px-3 py-1 text-xs font-bold ${style(item.status)}`}>{referralStatus[item.status]}</span></div><p className="mt-3 text-xs text-slate-400">Requested {date(item.created_at)}</p>{item.review_note && <p className="mt-2 text-sm text-slate-600">Admin note: {item.review_note}</p>}{item.payment_reference && <p className="mt-2 break-all text-sm text-emerald-700">Transfer reference: {item.payment_reference}</p>}</article>)}</div>
      </>}
    </>}
  </div>;
}
