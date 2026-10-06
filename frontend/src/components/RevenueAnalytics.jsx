import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Gift, IndianRupee, Loader2, ReceiptIndianRupee, RefreshCw, Store } from 'lucide-react';
import { API_BASE_URL } from '../config';

const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(paise || 0) / 100);
const number = new Intl.NumberFormat('en-IN');
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const PLAN_ORDER = ['basic', 'pro', 'advance', 'enterprise'];
const PLAN_TONES = { basic: 'bg-slate-500', pro: 'bg-emerald-600', advance: 'bg-violet-600', enterprise: 'bg-amber-500' };

function Metric({ icon: Icon, label, value, note, tone = 'emerald' }) {
  const tones = { emerald: 'bg-emerald-50 text-emerald-700', sky: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700' };
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`inline-flex rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{note}</p></article>;
}

export default function RevenueAnalytics({ session }) {
  const [range, setRange] = useState('30');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/revenue?range=${range}`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load revenue analytics.');
      if (!signal?.aborted) setData(result);
    } catch (loadError) { if (loadError.name !== 'AbortError') setError(loadError.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [range, session.token]);

  useEffect(() => {
    const controller = new AbortController();
    // State changes happen as the asynchronous API request progresses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const plans = useMemo(() => PLAN_ORDER.map((plan) => data?.plans?.find((item) => item.plan === plan) || { plan, payment_count: 0, paying_shops: 0, revenue_paise: 0, bonus_months_granted: 0 }), [data]);
  const maxTrend = Math.max(1, ...(data?.trend || []).map((item) => Number(item.revenue_paise)));
  const totalRevenue = Number(data?.totals?.gross_revenue_paise || 0);

  return <div><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Financial analytics</p><h1 className="mt-2 text-3xl font-black text-slate-950">Subscription revenue</h1><p className="mt-2 text-sm text-slate-500">Recorded shop subscription payments, plan contribution and revenue trend.</p></div><div className="flex gap-2"><select aria-label="Revenue date range" value={range} onChange={(event) => setRange(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All time</option></select><button type="button" onClick={() => load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2.5" aria-label="Refresh revenue"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></header>
    <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Revenue is based on subscription payments recorded by this application. It is gross revenue before refunds, gateway fees and taxes; demo payment references are included in non-production environments.</p>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {loading && !data ? <p className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading revenue analytics…</p> : data && <>
      <section className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric icon={IndianRupee} label="Gross revenue" value={money(data.totals.gross_revenue_paise)} note={`${number.format(Number(data.totals.payment_count || 0))} recorded payments`} /><Metric icon={CreditCard} label="Average payment" value={money(data.totals.average_payment_paise)} note="Per subscription payment" tone="sky" /><Metric icon={Store} label="Paying shops" value={number.format(Number(data.totals.paying_shops || 0))} note="Distinct shops in range" tone="violet" /><Metric icon={Gift} label="Free months" value={number.format(Number(data.totals.bonus_months_granted || 0))} note="Promotional months granted" tone="amber" /></section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black text-slate-900">Revenue trend</h2><p className="mt-1 text-xs text-slate-500">{range === '365' || range === 'all' ? 'Monthly' : 'Daily'} recorded revenue · {data.timezone}</p></div><span className="text-xs font-bold text-slate-400">{money(totalRevenue)} total</span></div><div className="mt-6 flex h-52 items-end gap-1 overflow-x-auto border-b border-slate-200 pb-1">{!data.trend.length ? <p className="m-auto text-sm text-slate-400">No payments in this period.</p> : data.trend.map((item) => <div key={item.period} title={`${date(item.period)}: ${money(item.revenue_paise)} from ${item.payment_count} payments`} className="group flex h-full min-w-3 flex-1 items-end"><div style={{ height: `${Math.max(3, Number(item.revenue_paise) / maxTrend * 100)}%` }} className="w-full rounded-t bg-gradient-to-t from-emerald-700 to-emerald-300 transition group-hover:from-emerald-800 group-hover:to-emerald-400" /></div>)}</div>{data.trend.length > 0 && <div className="mt-3 flex justify-between text-[11px] font-semibold text-slate-400"><span>{date(data.trend[0]?.period)}</span><span>{date(data.trend.at(-1)?.period)}</span></div>}</section>

      <section className="mt-6"><div><h2 className="text-lg font-black text-slate-900">Revenue by plan</h2><p className="mt-1 text-xs text-slate-500">See which subscription plan contributes the most.</p></div><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => { const share = totalRevenue > 0 ? Math.round(Number(plan.revenue_paise) / totalRevenue * 100) : 0; return <article key={plan.plan} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="font-black capitalize text-slate-900">{plan.plan}</p><span className="text-xs font-black text-slate-400">{share}%</span></div><p className="mt-3 text-2xl font-black text-slate-950">{money(plan.revenue_paise)}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div style={{ width: `${share}%` }} className={`h-full rounded-full ${PLAN_TONES[plan.plan]}`} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500"><span><strong className="block text-slate-800">{plan.payment_count}</strong>Payments</span><span><strong className="block text-slate-800">{plan.paying_shops}</strong>Shops</span></div>{Number(plan.bonus_months_granted) > 0 && <p className="mt-3 text-[11px] font-bold text-violet-700"><Gift className="mr-1 inline h-3 w-3" />{plan.bonus_months_granted} free months granted</p>}</article>; })}</div></section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><ReceiptIndianRupee className="h-5 w-5 text-emerald-700" /><h2 className="text-lg font-black text-slate-900">Recent subscription payments</h2></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="pb-3">Date</th><th className="pb-3">Shop</th><th className="pb-3">Plan</th><th className="pb-3">Paid term</th><th className="pb-3">Bonus</th><th className="pb-3 text-right">Amount</th></tr></thead><tbody>{!data.recent_payments.length && <tr><td colSpan="6" className="border-t border-slate-100 py-8 text-center text-slate-400">No recorded payments.</td></tr>}{data.recent_payments.map((payment) => <tr key={payment.id} className="border-t border-slate-100"><td className="py-3 text-slate-500"><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{date(payment.payment_confirmed_at)}</td><td className="py-3 font-bold text-slate-800">{payment.shop_name} <span className="text-xs font-medium text-slate-400">#{payment.shop_id}</span></td><td className="py-3 font-bold capitalize text-emerald-700">{payment.plan}</td><td className="py-3 text-slate-600">{payment.purchase_months} month{Number(payment.purchase_months) === 1 ? '' : 's'}</td><td className="py-3 text-violet-700">{Number(payment.bonus_months) > 0 ? `+${payment.bonus_months} months` : '—'}</td><td className="py-3 text-right font-black text-slate-900">{money(payment.amount_paise)}</td></tr>)}</tbody></table></div></section>
    </>}
  </div>;
}
