import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, BellRing, ChevronLeft, ChevronRight, CirclePause, Download, ExternalLink, Loader2, Mail, MapPin, Phone, RefreshCw, Search, ShieldCheck, Store, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(paise || 0) / 100);
const cleanPhone = (value) => String(value || '').replace(/[^+\d]/g, '');

function Pager({ pagination, setPage }) {
  if (!pagination?.total) return null;
  return <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{pagination.total} records · Page {pagination.page} of {Math.max(1, pagination.pages)}</span><div className="flex gap-2"><button type="button" disabled={pagination.page <= 1} onClick={() => setPage((x) => x - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPage((x) => x + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button></div></div>;
}

function exportCsv(filename, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [keys.map(escape).join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

export default function AdminManagement({ session, mode }) {
  const isUsers = mode === 'users';
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(''); const [debouncedQuery, setDebouncedQuery] = useState(''); const [page, setPage] = useState(1);
  const [primaryFilter, setPrimaryFilter] = useState('all'); const [secondaryFilter, setSecondaryFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all'); const [selectedShopIds, setSelectedShopIds] = useState([]);
  const [loading, setLoading] = useState(true); const [updating, setUpdating] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [currentTime] = useState(() => Date.now());
  useEffect(() => { const timer = setTimeout(() => { setPage(1); setDebouncedQuery(query.trim()); }, 300); return () => clearTimeout(timer); }, [query]);
  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ page, limit: 20, q: debouncedQuery });
    if (isUsers) params.set('verification', secondaryFilter);
    else { params.set('verification', primaryFilter); params.set('operation', secondaryFilter); params.set('subscription', subscriptionFilter); }
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/${mode}?${params}`, { headers: { Authorization: `Bearer ${session.token}` }, signal });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || `Unable to load ${mode}.`);
      if (!signal?.aborted) {
        const rows = result[mode] || [];
        const visibleRows = isUsers ? rows.filter((user) => user.user_type === 'customer' && !user.is_admin) : rows;
        setItems(visibleRows);
        if (!isUsers) setSelectedShopIds((current) => current.filter((id) => visibleRows.some((shop) => shop.id === id)));
        setPagination(result.pagination);
      }
    } catch (err) { if (err.name !== 'AbortError') setError(err.message); } finally { if (!signal?.aborted) setLoading(false); }
  }, [debouncedQuery, isUsers, mode, page, primaryFilter, secondaryFilter, session.token, subscriptionFilter]);
  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  const patchShop = async (shop, action) => {
    const verification = action === 'verification';
    setUpdating(`${action}-${shop.id}`); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shop.id}/${verification ? 'verification' : 'open-status'}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(verification ? { is_verified: !shop.is_verified } : { is_open: !shop.is_open }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Unable to update shop.'); await load();
    } catch (err) { setError(err.message); } finally { setUpdating(''); }
  };

  const isExpired = (shop) => Boolean(shop.subscription_ends_at) && new Date(shop.subscription_ends_at).getTime() <= currentTime;
  const toggleShop = (shopId) => setSelectedShopIds((current) => current.includes(shopId) ? current.filter((id) => id !== shopId) : [...current, shopId]);
  const expiredOnPage = items.filter(isExpired);
  const toggleAllExpired = () => setSelectedShopIds((current) => expiredOnPage.every((shop) => current.includes(shop.id)) ? current.filter((id) => !expiredOnPage.some((shop) => shop.id === id)) : [...new Set([...current, ...expiredOnPage.map((shop) => shop.id)])]);

  const sendReminders = async () => {
    if (!selectedShopIds.length) return;
    setUpdating('reminders'); setError(''); setNotice('');
    const results = await Promise.all(selectedShopIds.map(async (shopId) => {
      const response = await fetch(`${API_BASE_URL}/api/admin/shops/${shopId}/subscription-reminder`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send reminder.');
      return shopId;
    }).map((request) => request.then((shopId) => ({ ok: true, shopId })).catch((reason) => ({ ok: false, reason }))));
    const sent = results.filter((result) => result.ok).map((result) => result.shopId);
    const failed = results.filter((result) => !result.ok);
    if (sent.length) { setNotice(`Renewal reminder sent to ${sent.length} shop${sent.length === 1 ? '' : 's'}.`); setSelectedShopIds((current) => current.filter((id) => !sent.includes(id))); }
    if (failed.length) setError(failed.length === 1 ? failed[0].reason.message : `${failed.length} reminders could not be sent. They may already have received one in the last 24 hours.`);
    setUpdating('');
  };

  return <div><header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Account operations</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{isUsers ? 'Customer management' : 'Shop management'}</h1><p className="mt-2 text-sm text-slate-500">{isUsers ? 'Customer accounts only. Shop owners are listed under Shops; administrators are hidden.' : 'Review business details, subscriptions, catalogs and listing status.'}</p></div><div className="flex gap-2"><button type="button" onClick={() => exportCsv(`${mode}.csv`, items)} disabled={!items.length} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold disabled:opacity-40"><Download className="h-4 w-4" />Export page</button><button type="button" onClick={() => load()} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2.5" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div></header>
    {notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid gap-3 ${isUsers ? 'lg:grid-cols-[minmax(260px,1fr)_auto]' : 'lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto]'}`}><label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isUsers ? 'Search by customer name, 10-digit phone or email' : 'Search by shop, owner, 10-digit phone, area or category'} className="w-full bg-transparent text-sm outline-none" /></label>{!isUsers && <select value={primaryFilter} onChange={(e) => { setPrimaryFilter(e.target.value); setPage(1); }} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold outline-none"><option value="all">All verification</option><option value="pending">Pending</option><option value="verified">Verified</option></select>}<select value={secondaryFilter} onChange={(e) => { setSecondaryFilter(e.target.value); setPage(1); }} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold outline-none">{isUsers ? <><option value="all">All phone status</option><option value="verified">Phone verified</option><option value="unverified">Phone unverified</option></> : <><option value="all">Open and closed</option><option value="open">Open shops</option><option value="closed">Closed shops</option></>}</select>{!isUsers && <select value={subscriptionFilter} onChange={(e) => { setSubscriptionFilter(e.target.value); setPage(1); setSelectedShopIds([]); }} className="rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-bold outline-none"><option value="all">All subscriptions</option><option value="attention">Needs attention</option><option value="expiring">Expiring in 30 days</option><option value="expired">Expired subscriptions</option><option value="missing">Missing end date</option></select>}</div>
      {!isUsers && expiredOnPage.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-amber-900"><input type="checkbox" checked={expiredOnPage.every((shop) => selectedShopIds.includes(shop.id))} onChange={toggleAllExpired} className="h-4 w-4 accent-amber-700" />Select all expired shops on this page</label><button type="button" disabled={!selectedShopIds.length || updating === 'reminders'} onClick={sendReminders} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{updating === 'reminders' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}{updating === 'reminders' ? 'Sending reminders…' : `Send reminder${selectedShopIds.length === 1 ? '' : 's'} (${selectedShopIds.length})`}</button></div>}
      {loading && !items.length ? <p className="py-12 text-center text-sm text-slate-500">Loading {mode}…</p> : !items.length ? <p className="mt-5 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">No matching {mode} found.</p> : isUsers ? <div className="mt-5 grid gap-3 xl:grid-cols-2">{items.map((user) => <article key={user.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="rounded-xl bg-white p-2.5 text-slate-600 shadow-sm">{user.user_type === 'shop_owner' ? <Store className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span><div className="min-w-0"><p className="truncate font-black text-slate-900">{user.owner_name || 'Unnamed user'} <span className="text-xs font-medium text-slate-400">#{user.id}</span></p><p className="mt-1 text-xs capitalize text-slate-500">{user.is_admin ? 'Administrator' : user.user_type.replace('_', ' ')} · Joined {formatDate(user.created_at)}</p></div></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${user.phone_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{user.phone_verified ? 'Phone verified' : 'Unverified'}</span></div><div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><a href={`tel:${cleanPhone(user.phone)}`} className="flex items-center gap-2 rounded-lg bg-white p-2 text-slate-600"><Phone className="h-3.5 w-3.5" />{user.phone}</a>{user.email ? <a href={`mailto:${user.email}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-white p-2 text-slate-600"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{user.email}</span></a> : <span className="rounded-lg bg-white p-2 text-slate-400">No email</span>}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600"><span className="rounded-full bg-white px-2.5 py-1">{user.activity_count} activities</span><span className="rounded-full bg-white px-2.5 py-1">Reward {money(user.available_reward_paise)}</span>{user.shop_name && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">{user.shop_name} {user.shop_verified ? '✓' : '· pending'}</span>}</div></article>)}</div> : <div className="mt-5 grid gap-4 xl:grid-cols-2">{items.map((shop) => <article key={shop.id} className={`rounded-2xl border p-4 ${selectedShopIds.includes(shop.id) ? 'border-amber-400 bg-amber-50' : 'border-slate-100 bg-slate-50'}`}>{isExpired(shop) && <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-900"><input type="checkbox" checked={selectedShopIds.includes(shop.id)} onChange={() => toggleShop(shop.id)} className="h-4 w-4 accent-amber-700" />Select for renewal reminder</label>}<div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-black text-slate-900">{shop.name} <span className="text-xs font-medium text-slate-400">#{shop.id}</span></p><p className="mt-1 text-xs capitalize text-slate-500">{shop.category || 'Others'} · {shop.subscription_plan} · {shop.subscription_status}</p><p className={`mt-1 text-xs font-bold ${isExpired(shop) ? 'text-rose-700' : 'text-slate-500'}`}>{shop.subscription_ends_at ? `${isExpired(shop) ? 'Expired' : 'Ends'} ${formatDate(shop.subscription_ends_at)}` : 'Subscription end date missing'}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${shop.is_verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{shop.is_verified ? 'Verified' : 'Pending'}</span></div><div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-600"><p className="font-bold text-slate-800">{shop.owner_name || 'Unnamed owner'} · #{shop.owner_id}</p><div className="mt-2 flex flex-wrap gap-3"><a href={`tel:${cleanPhone(shop.owner_phone)}`} className="inline-flex items-center gap-1 text-emerald-700"><Phone className="h-3.5 w-3.5" />{shop.owner_phone}</a>{shop.google_map_link && <a href={shop.google_map_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-700"><MapPin className="h-3.5 w-3.5" />Map<ExternalLink className="h-3 w-3" /></a>}</div>{shop.address && <p className="mt-2 line-clamp-2 text-slate-500">{shop.address}</p>}</div><div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500"><span className="rounded-lg bg-white p-2"><strong className="block text-base text-slate-900">{shop.product_count}</strong>Products</span><span className="rounded-lg bg-white p-2"><strong className="block text-base text-slate-900">{shop.active_offer_count}</strong>Offers</span><span className="rounded-lg bg-white p-2"><strong className="block text-base text-slate-900">{shop.review_count}</strong>Reviews</span><span className="rounded-lg bg-white p-2"><strong className="block text-base text-slate-900">{shop.activity_count}</strong>Actions</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" disabled={updating === `verification-${shop.id}`} onClick={() => patchShop(shop, 'verification')} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${shop.is_verified ? 'bg-amber-100 text-amber-800' : 'bg-slate-900 text-white'}`}><BadgeCheck className="h-4 w-4" />{shop.is_verified ? 'Remove verification' : 'Verify shop'}</button><button type="button" disabled={updating === `operation-${shop.id}`} onClick={() => patchShop(shop, 'operation')} className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${shop.is_open ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{shop.is_open ? <CirclePause className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{shop.is_open ? 'Mark temporarily closed' : 'Reopen shop'}</button></div></article>)}</div>}
      <Pager pagination={pagination} setPage={setPage} />
    </section></div>;
}
