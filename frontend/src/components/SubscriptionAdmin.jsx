import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BellRing, CalendarDays, Gift, Loader2, Phone, RefreshCw, Save, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const PLANS = [['basic', 'Basic'], ['pro', 'Pro'], ['advance', 'Advance'], ['enterprise', 'Enterprise']];
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
const dateTimeLocal = (value) => {
  const parsed = value ? new Date(value) : new Date();
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const blankPromotion = () => ({
  name: '2027 Annual Offer', is_active: true, purchase_months: 1, bonus_months: 11,
  eligible_plans: PLANS.map(([id]) => id), starts_at: dateTimeLocal(new Date()), ends_at: '2027-12-31T23:59',
});
const subscriptionSnapshotTime = Date.now();
const daysLeft = (value, now = subscriptionSnapshotTime) => value ? Math.ceil((new Date(value).getTime() - now) / 86400000) : null;

export default function SubscriptionAdmin({ session }) {
  const [status, setStatus] = useState('attention');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [promotion, setPromotion] = useState(null);
  const [promotionExists, setPromotionExists] = useState(false);
  const [promotionLoading, setPromotionLoading] = useState(true);
  const [savingPromotion, setSavingPromotion] = useState(false);

  const headers = { Authorization: `Bearer ${session.token}` };
  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subscriptions?status=${status}`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load subscriptions.');
      if (!signal?.aborted) setItems(data.subscriptions || []);
    } catch (loadError) { if (loadError.name !== 'AbortError') setError(loadError.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [session.token, status]);

  const loadPromotion = useCallback(async (signal) => {
    setPromotionLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subscription-promotion`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load the subscription offer.');
      if (!signal?.aborted) {
        setPromotionExists(Boolean(data.promotion));
        setPromotion(data.promotion ? { ...data.promotion, starts_at: dateTimeLocal(data.promotion.starts_at), ends_at: dateTimeLocal(data.promotion.ends_at) } : blankPromotion());
      }
    } catch (loadError) { if (loadError.name !== 'AbortError') setError(loadError.message); }
    finally { if (!signal?.aborted) setPromotionLoading(false); }
  }, [session.token]);

  useEffect(() => {
    const controller = new AbortController();
    // State changes happen as the asynchronous API request progresses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    // State changes happen as the asynchronous API request progresses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPromotion(controller.signal);
    return () => controller.abort();
  }, [loadPromotion]);

  const savePromotion = async (event) => {
    event.preventDefault(); setSavingPromotion(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subscription-promotion`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...promotion, purchase_months: Number(promotion.purchase_months), bonus_months: Number(promotion.bonus_months), starts_at: new Date(promotion.starts_at).toISOString(), ends_at: new Date(promotion.ends_at).toISOString() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save the subscription offer.');
      setPromotion({ ...data.promotion, starts_at: dateTimeLocal(data.promotion.starts_at), ends_at: dateTimeLocal(data.promotion.ends_at) });
      setPromotionExists(true);
      setNotice(data.message);
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingPromotion(false); }
  };

  const removePromotion = async () => {
    if (!window.confirm('Remove this subscription offer? Bonus months already granted to existing purchases will remain.')) return;
    setSavingPromotion(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/subscription-promotion`, { method: 'DELETE', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to remove the subscription offer.');
      setPromotion(blankPromotion()); setPromotionExists(false); setNotice(data.message);
    } catch (removeError) { setError(removeError.message); }
    finally { setSavingPromotion(false); }
  };

  const togglePlan = (plan) => setPromotion((current) => ({ ...current, eligible_plans: current.eligible_plans.includes(plan) ? current.eligible_plans.filter((item) => item !== plan) : [...current.eligible_plans, plan] }));

  const remind = async (shop) => {
    setBusyId(shop.id); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}/subscription-reminder`, { method: 'POST', headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send reminder.');
      setNotice(`${shop.name}: renewal reminder sent.`);
    } catch (sendError) { setError(sendError.message); }
    finally { setBusyId(null); }
  };

  return <div><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Revenue operations</p><h1 className="mt-2 text-3xl font-black text-slate-950">Shop subscriptions</h1><p className="mt-2 text-sm text-slate-500">Control launch offers, track validity and remind shop owners.</p></div><button type="button" onClick={() => { load(); loadPromotion(); }} disabled={loading || promotionLoading} className="rounded-xl border border-slate-200 bg-white p-2.5"><RefreshCw className={`h-4 w-4 ${loading || promotionLoading ? 'animate-spin' : ''}`} /></button></header>
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

    <section className="mt-6 rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3"><span className="rounded-xl bg-violet-700 p-2.5 text-white"><Gift className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-slate-950">Launch subscription offer</h2><p className="mt-1 text-sm text-slate-600">Each shop can redeem a campaign once. Editing, disabling, or re-enabling it will not grant a second redemption. Remove it and create a new offer to start a new campaign. Bonus time already purchased always remains.</p></div></div>
      {promotionLoading || !promotion ? <p className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading offer settings…</p> : <form onSubmit={savePromotion} className="mt-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-3"><label className="text-xs font-bold text-slate-600 md:col-span-1">Offer name<input required maxLength={120} value={promotion.name} onChange={(event) => setPromotion({ ...promotion, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-slate-600">Paid months<input required type="number" min="1" max="36" value={promotion.purchase_months} onChange={(event) => setPromotion({ ...promotion, purchase_months: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-slate-600">Free add-on months<input required type="number" min="1" max="36" value={promotion.bonus_months} onChange={(event) => setPromotion({ ...promotion, bonus_months: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label></div>
        <fieldset><legend className="text-xs font-bold text-slate-600">Eligible plans</legend><div className="mt-2 flex flex-wrap gap-2">{PLANS.map(([id, label]) => <label key={id} className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-bold ${promotion.eligible_plans.includes(id) ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}><input type="checkbox" checked={promotion.eligible_plans.includes(id)} onChange={() => togglePlan(id)} className="sr-only" />{label}</label>)}</div><p className="mt-2 text-[11px] text-slate-500">All plans use a one-month paid term, so this offer can include Basic, Pro, Advance and Enterprise.</p></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Offer starts<input required type="datetime-local" value={promotion.starts_at} onChange={(event) => setPromotion({ ...promotion, starts_at: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label><label className="text-xs font-bold text-slate-600">Offer ends<input required type="datetime-local" value={promotion.ends_at} onChange={(event) => setPromotion({ ...promotion, ends_at: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white p-4"><label className="flex items-center gap-3 text-sm font-bold text-slate-800"><input type="checkbox" checked={promotion.is_active} onChange={(event) => setPromotion({ ...promotion, is_active: event.target.checked })} className="h-5 w-5 accent-violet-700" />Enable this offer</label><div className="flex flex-wrap gap-2">{promotionExists && <button type="button" onClick={removePromotion} disabled={savingPromotion} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-40"><Trash2 className="h-4 w-4" />Remove offer</button>}<button type="submit" disabled={savingPromotion || !promotion.eligible_plans.length} className="flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">{savingPromotion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{savingPromotion ? 'Saving…' : promotionExists ? 'Save changes' : 'Create offer'}</button></div></div>
      </form>}
    </section>

    <div className="mt-7 flex flex-wrap gap-2">{[['attention', 'Needs attention'], ['expiring', 'Expiring in 30 days'], ['expired', 'Expired'], ['missing', 'Missing end date'], ['all', 'All shops']].map(([value, label]) => <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${status === value ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</div>
    {loading && !items.length ? <p className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading subscriptions…</p> : !items.length ? <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No shops match this subscription status.</p> : <div className="mt-6 grid gap-4 xl:grid-cols-2">{items.map((shop) => { const remaining = daysLeft(shop.subscription_ends_at); return <article key={shop.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="font-black text-slate-900">{shop.name} <span className="text-xs font-medium text-slate-400">#{shop.id}</span></h2><p className="mt-1 text-xs text-slate-500">{shop.owner_name || 'Unnamed owner'} · <a className="text-emerald-700" href={`tel:${shop.owner_phone}`}><Phone className="mr-1 inline h-3 w-3" />{shop.owner_phone}</a></p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${shop.term_status === 'active' ? 'bg-emerald-100 text-emerald-700' : shop.term_status === 'expiring' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'}`}>{shop.term_status}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><p className="text-slate-400">Current plan</p><p className="mt-1 font-bold uppercase text-slate-800">{shop.subscription_plan}</p></div><div><p className="text-slate-400">Term ends</p><p className="mt-1 font-bold text-slate-800">{date(shop.subscription_ends_at)}</p></div></div>{Number(shop.subscription_bonus_months) > 0 && <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800"><Gift className="mr-1.5 inline h-3.5 w-3.5" />{shop.subscription_promotion_name || 'Promotional offer'} · {shop.subscription_bonus_months} free months included</p>}<p className="mt-3 flex items-center gap-2 text-xs text-slate-600">{remaining == null ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : <CalendarDays className="h-4 w-4 text-amber-600" />}{remaining == null ? 'No subscription end date recorded' : remaining <= 0 ? `Expired ${Math.abs(remaining)} days ago` : `${remaining} days remaining`}{shop.subscription_status === 'cancelled' ? ' · Renewal cancelled' : ''}</p><button type="button" disabled={busyId === shop.id} onClick={() => remind(shop)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busyId === shop.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}{busyId === shop.id ? 'Sending…' : 'Send renewal reminder'}</button></article>; })}</div>}
  </div>;
}
