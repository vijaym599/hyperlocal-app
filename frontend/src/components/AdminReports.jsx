import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MessageSquareWarning, RefreshCw, Search, Send } from 'lucide-react';
import { API_BASE_URL } from '../config';

const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const categoryLabel = (value) => ({ technical: 'Technical problem', account: 'Account & login', shop_listing: 'Shop listing', product: 'Product information', billing: 'Subscription & billing', safety: 'Safety or misuse', other: 'Other' }[value] || value);

export default function AdminReports({ session }) {
  const [reports, setReports] = useState([]); const [pagination, setPagination] = useState(null); const [page, setPage] = useState(1);
  const [status, setStatus] = useState('open'); const [role, setRole] = useState('all'); const [query, setQuery] = useState(''); const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState({}); const [loading, setLoading] = useState(true); const [busyId, setBusyId] = useState(null); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ status, role, q: search, page });
      const response = await fetch(`${API_BASE_URL}/api/admin/reports?${params}`, { headers: { Authorization: `Bearer ${session.token}` }, signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load complaints.');
      if (!signal?.aborted) {
        setReports(data.reports || []); setPagination(data.pagination);
        setDrafts(Object.fromEntries((data.reports || []).map((item) => [item.id, { status: item.status, admin_response: item.admin_response || '' }])));
      }
    } catch (loadError) { if (loadError.name !== 'AbortError') setError(loadError.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, role, search, session.token, status]);

  useEffect(() => { const controller = new AbortController(); void Promise.resolve().then(() => load(controller.signal)); return () => controller.abort(); }, [load]);

  const save = async (report) => {
    const draft = drafts[report.id]; if (!draft) return;
    setBusyId(report.id); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/reports/${report.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update complaint.');
      setNotice(`Complaint #${report.id} updated. The sender can see your response.`); await load();
    } catch (saveError) { setError(saveError.message); }
    finally { setBusyId(null); }
  };

  return <div>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Support operations</p><h1 className="mt-2 text-3xl font-black text-slate-950">Complaints</h1><p className="mt-2 text-sm text-slate-500">Review customer and shop-owner complaints, respond, and track resolution.</p></div><button type="button" onClick={() => load()} disabled={loading} aria-label="Refresh complaints" className="rounded-xl border border-slate-200 bg-white p-2.5"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></header>
    {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{notice}</p>}{error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(query.trim()); }} className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto_auto_auto]"><label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={80} placeholder="Search name, phone, shop, subject or details" className="w-full bg-transparent py-3 text-sm outline-none" /></label><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold"><option value="all">All status</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select><select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold"><option value="all">All senders</option><option value="customer">Customers</option><option value="shop_owner">Shop owners</option></select><button className="rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white">Search</button></form>
    {loading && !reports.length ? <p className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading complaints…</p> : !reports.length ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><MessageSquareWarning className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">No complaints match these filters.</p></div> : <div className="mt-6 space-y-4">{reports.map((report) => {
      const draft = drafts[report.id] || { status: report.status, admin_response: report.admin_response || '' };
      return <article key={report.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]"><div><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Complaint #{report.id} · {categoryLabel(report.category)}</p><h2 className="mt-1 break-words text-lg font-black text-slate-900">{report.subject}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase text-slate-600">{report.status.replace('_', ' ')}</span></div><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{report.description}</p><p className="mt-3 text-xs text-slate-400">Submitted {dateTime(report.created_at)}</p><div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs sm:grid-cols-2"><div><p className="font-bold uppercase text-slate-400">Sender</p><p className="mt-1 font-bold text-slate-800">{report.owner_name || 'Unnamed'} · #{report.user_id}</p><p className="mt-1 break-all text-slate-600">{report.phone}{report.email ? ` · ${report.email}` : ''}</p></div><div><p className="font-bold uppercase text-slate-400">Account type</p><p className="mt-1 font-bold capitalize text-slate-800">{report.reporter_role.replace('_', ' ')}</p>{report.shop_id && <p className="mt-1 text-slate-600">{report.shop_name} · Shop #{report.shop_id}</p>}</div></div></div><div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="text-xs font-bold text-slate-600">Status<select value={draft.status} onChange={(event) => setDrafts((items) => ({ ...items, [report.id]: { ...draft, status: event.target.value } }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label className="mt-4 block text-xs font-bold text-slate-600">Response to sender<textarea rows="6" maxLength={3000} value={draft.admin_response} onChange={(event) => setDrafts((items) => ({ ...items, [report.id]: { ...draft, admin_response: event.target.value } }))} placeholder="Explain what was checked, the action taken, and any next step." className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6" /></label><p className="mt-2 text-[11px] text-slate-400">{draft.admin_response.length}/3000 · A response is required to resolve or close.</p><button type="button" onClick={() => save(report)} disabled={busyId === report.id} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busyId === report.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{busyId === report.id ? 'Sending…' : 'Save & notify sender'}</button>{report.responded_at && <p className="mt-3 text-[11px] text-slate-400">Last response: {dateTime(report.responded_at)}{report.response_seen_at ? ' · Seen by sender' : ' · Not seen yet'}</p>}</div></div></article>;
    })}</div>}
    {pagination?.pages > 1 && <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><span>{pagination.total} complaints · Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Previous complaints page"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border p-2 disabled:opacity-40" aria-label="Next complaints page"><ChevronRight className="h-4 w-4" /></button></div></div>}
  </div>;
}
