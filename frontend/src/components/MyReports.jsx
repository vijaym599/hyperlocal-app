import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, MessageSquareText, RefreshCw, Send } from 'lucide-react';
import { API_BASE_URL } from '../config';

const categories = [
  ['technical', 'Technical problem'], ['account', 'Account or login'], ['shop_listing', 'Shop listing information'],
  ['product', 'Product information'], ['billing', 'Subscription or billing'], ['safety', 'Safety, spam or misuse'], ['other', 'Other problem'],
];
const categoryLabel = (value) => ({ technical: 'Technical problem', account: 'Account & login', shop_listing: 'Shop listing', product: 'Product information', billing: 'Subscription & billing', safety: 'Safety or misuse', other: 'Other' }[value] || value);
const statusStyle = { open: 'bg-amber-100 text-amber-800', in_progress: 'bg-sky-100 text-sky-800', resolved: 'bg-emerald-100 text-emerald-800', closed: 'bg-slate-200 text-slate-700' };
const statusLabel = (value) => ({ open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }[value] || value);
const dateTime = (value) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const field = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function MyReports({ session, refreshKey = 0, title = 'My complaints', allowCreate = false }) {
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ category: 'technical', subject: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/mine?page=${page}`, { headers: { Authorization: `Bearer ${session.token}` }, signal, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load your complaints.');
      if (!signal?.aborted) { setReports(data.reports || []); setPagination(data.pagination); }
    } catch (loadError) { if (loadError.name !== 'AbortError') setError(loadError.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, session.token]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load, refreshKey, reloadKey]);

  const submit = async (event) => {
    event.preventDefault(); setSubmitting(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send your complaint.');
      setForm({ category: 'technical', subject: '', description: '' });
      setNotice(data.message || 'Your complaint was sent successfully.');
      setPage(1); setReloadKey((value) => value + 1);
    } catch (submitError) { setError(submitError.message); }
    finally { setSubmitting(false); }
  };

  const markRead = async (report) => {
    if (!report.admin_response || report.response_seen_at) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/reports/${report.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.token}` } });
      if (response.ok) setReports((items) => items.map((item) => item.id === report.id ? { ...item, response_seen_at: new Date().toISOString() } : item));
    } catch { /* Keep the response visible if the read receipt fails. */ }
  };

  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><MessageSquareText className="h-5 w-5 text-emerald-700" />{title}</h2><p className="mt-1 text-sm text-slate-500">Send a complaint, track its status, and read the administrator response.</p></div><button type="button" onClick={() => load()} disabled={loading} aria-label="Refresh complaints" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button></div>

    {allowCreate && <form onSubmit={submit} className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-900">Create a complaint</h3><p className="mt-1 text-xs text-slate-500">Describe the issue clearly. The admin response will appear below.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-emerald-700">Private support</span></div>
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-3 text-sm font-semibold text-emerald-900">{notice}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs font-bold text-slate-600">Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={field}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold text-slate-600">Subject<input required minLength={5} maxLength={140} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Example: Unable to update a product" className={field} /></label></div>
      <label className="mt-3 block text-xs font-bold text-slate-600">Complaint details<textarea required minLength={20} maxLength={3000} rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Explain what happened, where it happened, and what you expected. Do not share passwords or OTP codes." className={`${field} resize-y leading-6`} /></label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><span className="text-[11px] text-slate-400">Minimum 20 characters · {form.description.length}/3000</span><button type="submit" disabled={submitting} className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{submitting ? 'Sending…' : 'Send complaint'}</button></div>
    </form>}

    {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <h3 className="mt-6 text-sm font-black text-slate-800">Complaint history</h3>
    {loading && !reports.length ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading complaints…</p> : !reports.length ? <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-600">No complaints submitted yet.</p></div> : <div className="mt-4 space-y-3">{reports.map((report) => <article key={report.id} onMouseEnter={() => markRead(report)} onFocus={() => markRead(report)} tabIndex="0" className={`rounded-2xl border p-4 outline-none ${report.admin_response && !report.response_seen_at ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Complaint #{report.id} · {categoryLabel(report.category)}</p><h3 className="mt-1 break-words font-black text-slate-900">{report.subject}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusStyle[report.status] || statusStyle.open}`}>{statusLabel(report.status)}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{report.description}</p><p className="mt-3 flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3.5 w-3.5" />Submitted {dateTime(report.created_at)}</p>{report.admin_response && <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Admin response</p>{!report.response_seen_at && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">New</span>}</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{report.admin_response}</p><p className="mt-2 text-[11px] text-slate-400">{report.responded_by_name ? `${report.responded_by_name} · ` : ''}{dateTime(report.responded_at)}</p></div>}</article>)}</div>}
    {pagination?.pages > 1 && <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{pagination.total} complaints · Page {pagination.page} of {pagination.pages}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Previous complaints page"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40" aria-label="Next complaints page"><ChevronRight className="h-4 w-4" /></button></div></div>}
  </section>;
}
