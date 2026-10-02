import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Wallet } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { formatMoney, referralStatus } from '../referrals.mjs';

const validPhone = (value) => /^\+?[1-9]\d{7,14}$/.test(String(value || ''));
const actions = { verify: 'Verify payment & credit reward', approve: 'Approve redemption', reject: 'Reject with reason', paid: 'Confirm completed payout' };

export default function ReferralAdmin({ session }) {
  const [data, setData] = useState({ earnings: [], redemptions: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState('redemptions');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('action');
  const [review, setReview] = useState(null);
  const [form, setForm] = useState({ note: '', payment_reference: '', checked: false });
  const [page, setPage] = useState(1);
  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/referrals?page=${page}`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load referrals.');
      if (!signal?.aborted) setData(result);
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [session.token, page]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);
  const select = (type, item, action) => { setReview({ type, item, action }); setForm({ note: '', payment_reference: '', checked: false }); setError(''); setNotice(''); };
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/referrals/${review.type}/${review.item.id}`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: review.action, note: form.note, payment_reference: form.payment_reference }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update referral.');
      setNotice(review.action === 'approve' ? 'Approved. The request is awaiting a completed payout.' : review.action === 'paid' ? 'Payout recorded with its transfer reference.' : review.action === 'verify' ? 'Payment review recorded. Reward credited to the user wallet.' : 'Rejected. Redemption funds, if reserved, are available again.');
      setReview(null); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const needsAction = (item) => ['pending', 'approved', 'pending_verification'].includes(item.status);
  const list = (data[tab] || []).filter((item) => (filter === 'all' || needsAction(item)) && [item.user_name, item.user_id, item.user_phone, item.shop_name, item.referred_shop_id, item.upi_id, ...(item.shops || []).map((shop) => `${shop.shop_name} ${shop.shop_id}`)].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <section className="mb-7 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Wallet className="h-5 w-5 text-emerald-700" />Referral rewards & redemptions</h2><p className="mt-2 text-sm text-slate-500">Check the first subscription payment, approve rewards, then review user payout requests.</p></div><button type="button" disabled={loading || busy} onClick={() => load()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-5 flex flex-wrap gap-2">{[['redemptions', 'Redemption requests'], ['earnings', 'Referred shops']].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setReview(null); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}</div>
    <div className="mt-4 flex flex-wrap gap-3"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this page: user, phone, shop name or ID" aria-label="Search referral records on this page" className="w-full bg-transparent text-sm outline-none" /></label><select aria-label="Referral status filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold"><option value="action">Needs action</option><option value="all">All statuses</option></select></div>
    {loading && <p className="mt-4 text-sm text-slate-500">Loading referral records…</p>}
    {!loading && !list.length && <p className="mt-4 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No matching records on this page.</p>}
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{list.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold text-slate-900">{item.user_name || 'Customer'} · User #{item.user_id}</h3><p className="mt-1 text-sm text-slate-700">{item.user_phone || 'No phone'} · <span className={validPhone(item.user_phone) ? 'text-emerald-700' : 'text-rose-700'}>{validPhone(item.user_phone) ? 'Valid phone format' : 'Invalid phone'}</span></p><p className="mt-1 text-xs text-slate-500">{item.phone_verified ? 'Phone verified' : 'Phone ownership not verified'}</p></div><div className="text-right"><p className="font-black text-emerald-700">{formatMoney(tab === 'earnings' ? item.reward_paise : item.amount_paise)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{referralStatus[item.status]}</p></div></div>
      {tab === 'earnings' ? <div className="mt-3 rounded-xl bg-white p-3 text-sm"><p className="font-bold">{item.shop_name} · Shop #{item.referred_shop_id}</p><p className="mt-1 text-slate-500">Owner phone: {item.owner_phone}</p><p className="mt-1 capitalize text-slate-500">{item.subscription_plan} · {formatMoney(item.subscription_price_paise)} first subscription · 20% reward</p>{item.payment_reference && <p className="mt-1 break-all text-xs text-slate-500">Subscription payment: {item.payment_reference}</p>}</div> : <div className="mt-3 rounded-xl bg-white p-3 text-sm"><p className="font-bold">Request #{item.id} · {item.account_name}</p><p className="mt-1 break-all text-slate-600">UPI: {item.upi_id} · Request phone: {item.phone}</p><div className="mt-2 space-y-1">{item.shops.map((shop) => <p key={shop.shop_id} className="text-xs text-slate-500">{shop.shop_name} · Shop #{shop.shop_id} · {shop.subscription_plan} · Reward {formatMoney(shop.reward_paise)}</p>)}</div>{item.payment_reference && <p className="mt-2 break-all text-xs text-emerald-700">Transfer: {item.payment_reference}</p>}</div>}
      <p className="mt-3 text-xs text-slate-400">{new Date(item.created_at).toLocaleString('en-IN')}</p>{item.review_note && <p className="mt-2 text-sm text-slate-600">Review: {item.review_note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{(tab === 'earnings' ? item.status === 'pending_verification' ? ['verify', 'reject'] : [] : item.status === 'pending' ? ['approve', 'reject'] : item.status === 'approved' ? ['paid', 'reject'] : []).map((action) => <button type="button" disabled={busy || loading} key={action} onClick={() => select(tab, item, action)} className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${action === 'reject' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-600 text-white'}`}>{actions[action]}</button>)}</div>
    </article>)}</div>
    <div className="mt-4 flex items-center justify-between"><button type="button" disabled={page === 1 || loading || busy} onClick={() => { setPage(page - 1); setReview(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Previous</button><span className="text-xs text-slate-500">Page {page}</span><button type="button" disabled={!data.has_more || loading || busy} onClick={() => { setPage(page + 1); setReview(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button></div>
    {review && <form onSubmit={submit} className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h3 className="font-bold text-slate-900">{actions[review.action]} · #{review.item.id}</h3><p className="mt-2 text-sm text-slate-600">{review.item.user_name} · {formatMoney(review.type === 'earnings' ? review.item.reward_paise : review.item.amount_paise)}</p>{review.action === 'approve' && <p className="mt-2 text-sm text-slate-600">This approves the request for payout. It does not transfer money.</p>}{['verify', 'paid'].includes(review.action) && <><label className="mt-3 block text-xs font-bold text-slate-600">{review.action === 'verify' ? 'Real subscription payment reference' : 'Completed payout transaction reference'}<input required minLength={3} maxLength={150} value={form.payment_reference} onChange={(event) => setForm({ ...form, payment_reference: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label><label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" required checked={form.checked} onChange={(event) => setForm({ ...form, checked: event.target.checked })} className="mt-1" />{review.action === 'verify' ? `I checked that this shop's first subscription payment of ${formatMoney(review.item.subscription_price_paise)} was received.` : `I completed the transfer of ${formatMoney(review.item.amount_paise)} to ${review.item.upi_id}.`}</label></>}
      <label className="mt-3 block text-xs font-bold text-slate-600">{review.action === 'reject' ? 'Rejection reason' : 'Review note (optional)'}<textarea required={review.action === 'reject'} maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></label><div className="mt-3 flex gap-2"><button disabled={busy || loading} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : actions[review.action]}</button><button type="button" disabled={busy} onClick={() => setReview(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">Cancel</button></div>
    </form>}
  </section>;
}
