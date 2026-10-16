import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BellRing, Boxes, CalendarDays, ChevronRight, IndianRupee, LayoutDashboard, LogOut, MessageSquareWarning, RefreshCw, ShieldCheck, Store, UserRound, UserRoundCog, UsersRound, WalletCards } from 'lucide-react';
import { API_BASE_URL } from '../config';
import DemandDashboard from './DemandDashboard';
import ReferralAdmin from './ReferralAdmin';
import AdminManagement from './AdminManagement';
import SubscriptionAdmin from './SubscriptionAdmin';
import RevenueAnalytics from './RevenueAnalytics';
import AdminReports from './AdminReports';
import ThemePreference from './ThemePreference';
import { requestError } from '../requestState.mjs';
import { ErrorState, FeedbackBanner, LoadingState, StatePanel } from './ui/StatePanel';

const number = new Intl.NumberFormat('en-IN');
const compactNumber = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const numeric = (value) => Number(value || 0);
const displayNumber = (value) => numeric(value) >= 100000 ? compactNumber.format(numeric(value)) : number.format(numeric(value));
const date = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const shortDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const pageLabel = (value) => ({ explore: 'Discover', 'shop-directory': 'Shops', offers: 'Offers', assistant: 'Ask Nearbuy', 'shop-portfolio': 'Shop portfolio', 'customer-auth': 'Customer account', activity: 'Customer activity', 'my-shop': 'Shop workspace', admin: 'Admin console', about: 'About', privacy: 'Privacy', terms: 'Terms', 'report-issue': 'Submit complaint', pricing: 'Pricing' }[value] || value);
const ADMIN_SECTIONS = new Set(['overview', 'users', 'shops', 'subscriptions', 'reports', 'revenue', 'operations', 'referrals', 'profile']);

function Stat({ icon: Icon, label, value, note, tone = 'emerald' }) {
  const colors = { emerald: 'bg-emerald-100 text-emerald-700', sky: 'bg-sky-100 text-sky-700', violet: 'bg-violet-100 text-violet-700', amber: 'bg-amber-100 text-amber-700' };
  return <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 truncate text-3xl font-black tracking-tight text-slate-900" title={number.format(numeric(value))}>{displayNumber(value)}</p>{note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</div><span className={`shrink-0 rounded-xl p-2.5 ${colors[tone]}`}><Icon className="h-5 w-5" /></span></div></article>;
}

function SummaryMetric({ label, value, note }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900" title={number.format(numeric(value))}>{displayNumber(value)}</p><p className="mt-0.5 text-[11px] text-slate-500">{note}</p></div>;
}

function niceChartMaximum(value) {
  if (value <= 10) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function TrafficChart({ daily, timezone, granularity = 'day' }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const selected = daily.find((item) => item.day === selectedDay) || daily.at(-1);
  const maximum = niceChartMaximum(Math.max(1, ...daily.map((item) => numeric(item.page_views))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maximum * ratio));
  const dateIndexes = [...new Set([0, Math.round((daily.length - 1) * 0.25), Math.round((daily.length - 1) * 0.5), Math.round((daily.length - 1) * 0.75), daily.length - 1])];
  const width = 1000; const height = 310; const left = 64; const right = 22; const top = 18; const bottom = 48;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const x = (index) => left + ((index + 0.5) / daily.length) * plotWidth;
  const y = (value) => top + plotHeight - (numeric(value) / maximum) * plotHeight;
  const groupWidth = plotWidth / Math.max(1, daily.length);
  const barWidth = Math.min(22, Math.max(4, groupWidth * 0.62));
  const axisDate = (value) => granularity === 'month' ? new Date(value).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : shortDate(value);
  const fullPeriod = (value) => granularity === 'month' ? new Date(value).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : date(value);
  return <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 className="text-lg font-black text-slate-900">Website traffic</h2><p className="mt-1 text-xs leading-5 text-slate-500">{granularity === 'month' ? 'Monthly' : 'Daily'} activity in {timezone}. Select a bar to see exact counts.</p></div><div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />Page views</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-700" />Unique visitors</span></div></div>
    {!daily.length ? <p className="p-8 text-center text-sm text-slate-500">Traffic will appear after visitors start using the website.</p> : <>
      <div className="overflow-x-auto px-3 py-4 sm:px-5"><svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[680px] w-full" role="img" aria-label={`${granularity === 'month' ? 'Monthly' : 'Daily'} page views and unique visitors chart`}>
        <text x="16" y="16" className="fill-slate-400 text-[10px] font-bold">COUNT</text>
        {ticks.map((tick) => { const tickY = y(tick); return <g key={tick}><line x1={left} x2={width - right} y1={tickY} y2={tickY} stroke="#e2e8f0" strokeWidth="1" /><text x={left - 10} y={tickY + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-semibold">{displayNumber(tick)}</text></g>; })}
        <line x1={left} x2={left} y1={top} y2={top + plotHeight} stroke="#94a3b8" /><line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="#94a3b8" />
        {daily.map((item, index) => { const views = numeric(item.page_views); const visitors = numeric(item.unique_visitors); const active = selected?.day === item.day; const center = x(index); const viewY = y(views); const visitorY = y(visitors); return <g key={item.day} role="button" tabIndex="0" onClick={() => setSelectedDay(item.day)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedDay(item.day); }} className="cursor-pointer outline-none"><title>{`${fullPeriod(item.day)} — ${number.format(views)} page views, ${number.format(visitors)} unique visitors`}</title>{active && <rect x={center - groupWidth / 2} y={top} width={groupWidth} height={plotHeight} fill="#ecfdf5" stroke="#34d399" strokeWidth="1.5" rx="3" />}<rect x={center - barWidth / 2} y={viewY} width={barWidth} height={Math.max(views ? 2 : 0, top + plotHeight - viewY)} fill="#6ee7b7" rx="2" /><rect x={center - barWidth * 0.22} y={visitorY} width={barWidth * 0.44} height={Math.max(visitors ? 2 : 0, top + plotHeight - visitorY)} fill="#334155" rx="1.5" /></g>; })}
        {dateIndexes.map((index) => <text key={index} x={x(index)} y={height - 15} textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">{axisDate(daily[index]?.day)}</text>)}
        <text x={width - right} y={height - 2} textAnchor="end" className="fill-slate-400 text-[9px] font-bold">{granularity === 'month' ? 'MONTH' : 'DATE'}</text>
      </svg></div>
      {selected && <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-3 xl:grid-cols-5 sm:px-5"><div className="col-span-2 sm:col-span-1"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Selected {granularity}</p><p className="mt-1 text-sm font-black text-slate-900">{fullPeriod(selected.day)}</p></div>{[['Page views', selected.page_views], ['Unique visitors', selected.unique_visitors], ['New customers', selected.new_users], ['New shops', selected.new_shops]].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{number.format(numeric(value))}</p></div>)}</div>}
    </>}
  </section>;
}

function Overview({ session, onSessionExpired }) {
  const [data, setData] = useState(null); const [days, setDays] = useState('all');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const load = useCallback(async (signal) => {
    setLoading(true); setError(null);
    try { const response = await fetch(`${API_BASE_URL}/api/admin/overview?days=${days}`, { headers: { Authorization: `Bearer ${session.token}` }, signal }); const result = await response.json(); if (!response.ok) throw requestError(response, result.error || 'Unable to load dashboard.'); if (!signal?.aborted) setData(result); }
    catch (err) { if (err.name !== 'AbortError') setError(err); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [days, session.token]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);
  const totals = data?.totals || {}; const today = data?.today || {};
  const summary = useMemo(() => {
    const daily = data?.daily || [];
    const totalViews = daily.reduce((sum, item) => sum + numeric(item.page_views), 0);
    const dailyUnique = daily.reduce((sum, item) => sum + numeric(item.unique_visitors), 0);
    const newCustomers = daily.reduce((sum, item) => sum + numeric(item.new_users), 0);
    const newShops = daily.reduce((sum, item) => sum + numeric(item.new_shops), 0);
    const peak = daily.reduce((best, item) => !best || numeric(item.page_views) > numeric(best.page_views) ? item : best, null);
    return { totalViews, dailyUnique, newCustomers, newShops, average: daily.length ? Math.round(totalViews / daily.length) : 0, peak };
  }, [data]);
  const maxPageViews = Math.max(1, ...(data?.pages || []).map((item) => numeric(item.page_views)));
  const rangeLabel = days === 'all' ? 'All time' : `Last ${days} days`;
  const periodUnit = data?.granularity === 'month' ? 'month' : 'day';
  return <div><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Business overview</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Admin dashboard</h1><p className="mt-2 text-sm text-slate-500">Users, shops, catalog growth and anonymous website visits in one place.</p></div><div className="flex items-center gap-2"><select aria-label="Analytics date range" value={days} onChange={(event) => setDays(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><option value="all">All time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><button type="button" onClick={() => load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 disabled:opacity-50" aria-label="Refresh overview"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></header>
    {error && data && <FeedbackBanner className="mt-5">Previously loaded dashboard data is shown. Refresh to try again.</FeedbackBanner>}
    {data && <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={UsersRound} label="Customer accounts" value={totals.total_users} note="Registered customer logins" /><Stat icon={Store} label="Shops" value={totals.total_shops} note={`${number.format(numeric(totals.verified_shops))} verified · ${number.format(Math.max(0, numeric(totals.total_shops) - numeric(totals.verified_shops)))} pending`} tone="sky" /><Stat icon={Boxes} label="Products" value={totals.total_products} note={`${number.format(numeric(totals.open_requests))} customer requests need review`} tone="violet" /><Stat icon={Activity} label="Page views today" value={today.page_views} note={`${number.format(numeric(today.unique_visitors))} unique browser visitors`} tone="amber" /></section>}
    {loading && !data && <LoadingState label="Loading dashboard data…" rows={5} className="mt-6" />}
    {!loading && error && !data && <ErrorState error={error} retryLabel={error.status === 401 ? 'Sign in again' : 'Try again'} onRetry={error.status === 401 ? onSessionExpired : () => load()} className="mt-6" />}
    {data && <><section className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black text-slate-900">{rangeLabel} summary</h2><p className="mt-1 text-xs text-slate-500">Quick totals for the selected date range</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{date(data.daily[0]?.day)} – {date(data.daily.at(-1)?.day)}</span></div><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"><SummaryMetric label="Total page views" value={summary.totalViews} note="All pages combined" /><SummaryMetric label={`${periodUnit === 'month' ? 'Monthly' : 'Daily'} unique total`} value={summary.dailyUnique} note="May include repeat visitors" /><SummaryMetric label={`Average per ${periodUnit}`} value={summary.average} note={`Page views per ${periodUnit}`} /><SummaryMetric label="New customers" value={summary.newCustomers} note="Accounts created" /><SummaryMetric label="New shops" value={summary.newShops} note="Businesses registered" /></div>{summary.peak && <p className="mt-3 text-xs text-slate-500"><strong className="text-slate-700">Peak traffic:</strong> {data.granularity === 'month' ? new Date(summary.peak.day).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : date(summary.peak.day)} with {number.format(numeric(summary.peak.page_views))} page views.</p>}</section>
      <TrafficChart daily={data.daily} timezone={data.timezone} granularity={data.granularity} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><DailyTable daily={data.daily} granularity={data.granularity} /><TopPages pages={data.pages} rangeLabel={rangeLabel} maxViews={maxPageViews} /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2"><RecentCustomers users={data.recent_users} /><RecentShops shops={data.recent_shops} /></div>
    </>}</div>;
}

function DailyTable({ daily, granularity = 'day' }) {
  const periodLabel = granularity === 'month' ? 'Monthly' : 'Daily';
  return <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="text-lg font-black text-slate-900">{periodLabel} breakdown</h2><p className="mt-1 text-xs text-slate-500">Newest {granularity} first · scroll to review the full period</p></div><div className="max-h-[420px] overflow-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{granularity === 'month' ? 'Month' : 'Date'}</th><th className="px-3 py-3 text-right">Page views</th><th className="px-3 py-3 text-right">Unique visitors</th><th className="px-3 py-3 text-right">New customers</th><th className="px-5 py-3 text-right">New shops</th></tr></thead><tbody>{[...daily].reverse().map((item) => <tr key={item.day} className="border-t border-slate-100 hover:bg-slate-50"><td className="px-5 py-3 font-semibold text-slate-700">{granularity === 'month' ? new Date(item.day).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : date(item.day)}</td><td className="px-3 py-3 text-right font-bold text-slate-800">{number.format(numeric(item.page_views))}</td><td className="px-3 py-3 text-right">{number.format(numeric(item.unique_visitors))}</td><td className="px-3 py-3 text-right">{number.format(numeric(item.new_users))}</td><td className="px-5 py-3 text-right">{number.format(numeric(item.new_shops))}</td></tr>)}</tbody></table></div></section>;
}

function TopPages({ pages, rangeLabel, maxViews }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-slate-900">Top pages</h2><p className="mt-1 text-xs text-slate-500">Ranked by page views · {rangeLabel}</p><div className="mt-4 space-y-3">{!pages.length && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Visits will appear after people use the website.</p>}{pages.map((item, index) => <div key={item.page_name} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800"><span className="mr-2 text-slate-400">#{index + 1}</span>{pageLabel(item.page_name)}</p><p className="mt-0.5 text-xs text-slate-500">{number.format(numeric(item.unique_visitors))} unique visitors</p></div><div className="text-right"><p className="text-lg font-black text-emerald-700">{displayNumber(item.page_views)}</p><p className="text-[10px] font-bold uppercase text-slate-400">views</p></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${numeric(item.page_views) / maxViews * 100}%` }} /></div></div>)}</div></section>;
}

function RecentCustomers({ users }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Recent customers</h2><p className="mt-1 text-xs text-slate-500">Latest registered customer accounts</p><div className="mt-4 space-y-2">{!users.length && <p className="text-sm text-slate-500">No customers yet.</p>}{users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{user.owner_name || 'Unnamed customer'} · #{user.id}</p><p className="mt-0.5 truncate text-xs text-slate-500">{user.phone} · Customer</p></div><span className="shrink-0 text-xs text-slate-400">{date(user.created_at)}</span></div>)}</div></section>;
}

function RecentShops({ shops }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Recent shops</h2><p className="mt-1 text-xs text-slate-500">Latest business registrations</p><div className="mt-4 space-y-2">{!shops.length && <p className="text-sm text-slate-500">No shops yet.</p>}{shops.map((shop) => <div key={shop.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{shop.name} · #{shop.id}</p><p className="mt-0.5 truncate text-xs capitalize text-slate-500">{shop.category || 'Other'} · {shop.subscription_plan}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${shop.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{shop.is_verified ? 'Verified' : 'Pending'}</span></div>)}</div></section>;
}

function AdminProfile({ session, onLogout, theme, onToggleTheme }) {
  const user = session?.user || {};
  return <div><header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Administrator account</p><h1 className="mt-2 text-3xl font-black text-slate-950">Profile</h1><p className="mt-2 text-sm text-slate-500">Review this account, choose your appearance and manage the current signed-in session.</p></header><div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-3"><span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><UserRound className="h-6 w-6" /></span><div><h2 className="text-lg font-black text-slate-900">Account information</h2><p className="text-xs text-slate-500">Administrator access</p></div></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Name</dt><dd className="mt-1 font-bold text-slate-900">{user.owner_name || user.name || 'Administrator'}</dd></div><div className="rounded-2xl bg-slate-50 p-4"><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Phone</dt><dd className="mt-1 font-bold text-slate-900">{user.phone || 'Not available'}</dd></div></dl></section><ThemePreference theme={theme} onToggleTheme={onToggleTheme} /><section className="h-fit rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm sm:p-6 xl:col-span-2"><LogOut className="h-6 w-6 text-rose-700" /><h2 className="mt-3 text-lg font-black text-rose-950">Sign out</h2><p className="mt-2 text-sm leading-6 text-rose-800">End this administrator session on the current device.</p><button type="button" onClick={onLogout} className="mt-5 rounded-xl bg-rose-700 px-4 py-3 text-sm font-bold text-white hover:bg-rose-800">Sign out this device</button></section></div></div>;
}

export default function AdminDashboard({ session, onSessionExpired, theme = 'light', onToggleTheme, initialSection, onSectionChange }) {
  const [localSection, setSection] = useState(ADMIN_SECTIONS.has(initialSection) ? initialSection : 'overview');
  const section = ADMIN_SECTIONS.has(initialSection) ? initialSection : localSection;
  const groups = [
    { label: 'Dashboard', items: [{ id: 'overview', label: 'Overview', icon: LayoutDashboard, note: 'Users, shops & visits' }] },
    { label: 'People & businesses', items: [{ id: 'users', label: 'Customers', icon: UsersRound, note: 'Accounts & activity' }, { id: 'shops', label: 'Shops', icon: Store, note: 'Business management' }, { id: 'subscriptions', label: 'Subscriptions', icon: BellRing, note: 'Plans & reminders' }] },
    { label: 'Operations', items: [{ id: 'operations', label: 'Product demand', icon: BarChart3, note: 'Requests & verification' }, { id: 'reports', label: 'Complaints', icon: MessageSquareWarning, note: 'Customer & shop issues' }] },
    { label: 'Finance', items: [{ id: 'revenue', label: 'Revenue', icon: IndianRupee, note: 'Income by plan' }, { id: 'referrals', label: 'Referrals', icon: WalletCards, note: 'Rewards & redemptions' }] },
    { label: 'Account', items: [{ id: 'profile', label: 'Account', icon: UserRound, note: 'Profile & sign out' }] },
  ];
  const items = groups.flatMap((group) => group.items);
  const selectSection = (next) => { setSection(next); onSectionChange?.(next); };
  if (!session?.user?.is_admin) return <div className="mx-auto max-w-xl px-4 py-8"><StatePanel kind="forbidden" icon={ShieldCheck} title="Administrator access required" description="Sign in with an administrator account to open this dashboard." /></div>;
  return <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6 lg:px-8"><label className="mb-4 block rounded-2xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-500 shadow-sm lg:hidden">Admin section<select value={section} onChange={(event) => selectSection(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800">{items.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label><div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"><aside className="hidden h-fit rounded-3xl bg-slate-950 p-4 text-white shadow-xl lg:sticky lg:top-24 lg:block"><div className="px-3 py-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-500 p-2"><UserRoundCog className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Admin console</p><p className="mt-1 truncate text-sm font-bold">{session.user.owner_name || 'Administrator'}</p></div></div></div><nav className="mt-3 space-y-4">{groups.map((group) => <div key={group.label}><p className="mb-1 px-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{group.label}</p>{group.items.map(({ id, label, icon: Icon, note }) => <button key={id} type="button" onClick={() => selectSection(id)} aria-current={section === id ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${section === id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-950/30' : 'text-slate-300 hover:bg-white/10'}`}><Icon className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold">{label}</span><span className={`block truncate text-[10px] ${section === id ? 'text-emerald-50' : 'text-slate-500'}`}>{note}</span></span><ChevronRight className="h-4 w-4 shrink-0" /></button>)}</div>)}</nav><div className="mt-5 rounded-2xl bg-white/5 p-3 text-xs text-slate-400"><CalendarDays className="mb-2 h-4 w-4 text-emerald-400" />Analytics uses anonymous browser IDs. No visitor phone or IP is stored.</div></aside><main className="min-w-0 rounded-3xl bg-slate-50/70 p-1 sm:p-3">{section === 'overview' && <Overview session={session} onSessionExpired={onSessionExpired} />}{section === 'users' && <AdminManagement key="users" session={session} mode="users" />}{section === 'shops' && <AdminManagement key="shops" session={session} mode="shops" />}{section === 'subscriptions' && <SubscriptionAdmin session={session} />}{section === 'reports' && <AdminReports session={session} />}{section === 'revenue' && <RevenueAnalytics session={session} />}{section === 'operations' && <DemandDashboard session={session} embedded />}{section === 'referrals' && <><header className="mb-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Finance operations</p><h1 className="mt-2 text-3xl font-black">Referral management</h1></header><ReferralAdmin session={session} /></>}{section === 'profile' && <AdminProfile session={session} onLogout={onSessionExpired} theme={theme} onToggleTheme={onToggleTheme} />}</main></div></div>;
}
