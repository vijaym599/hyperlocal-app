import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Loader2, MapPin, Store } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ShopDirectory({ onOpenShop, onBack }) {
  const [page, setPage] = useState(1);
  return <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <button type="button" onClick={onBack} className="mb-5 flex items-center gap-2 text-sm font-semibold text-emerald-700"><ArrowLeft className="h-4 w-4" />Back</button>
    <h1 className="text-2xl font-extrabold text-slate-900">Browse local shop catalogs</h1>
    <p className="mt-2 text-sm text-slate-500">Choose a shop to see its products and contact details.</p>
    <DirectoryPage key={page} page={page} setPage={setPage} onOpenShop={onOpenShop} />
  </section>;
}

function DirectoryPage({ page, setPage, onOpenShop }) {
  const [shops, setShops] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/catalogs?page=${page}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load shops.');
        setShops(data.shops || []); setHasMore(Boolean(data.has_more)); setError('');
      } catch (err) { if (err.name !== 'AbortError') setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [page, retry]);
  if (loading) return <p role="status" className="mt-8 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading shops…</p>;
  if (error) return <div role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}<button type="button" onClick={() => { setLoading(true); setRetry(value => value + 1); }} className="ml-3 font-bold underline">Retry</button></div>;
  return <>
    {!shops.length && <p className="mt-6 rounded-xl border border-dashed p-6 text-sm text-slate-500">No shops listed yet.</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shops.map(shop => <button key={shop.id} type="button" onClick={() => onOpenShop(shop)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-400 hover:shadow-md focus-visible:outline focus-visible:outline-emerald-500"><div className="flex items-start gap-3"><Store className="h-6 w-6 shrink-0 text-emerald-700" /><h2 className="min-w-0 flex-1 break-words text-lg font-bold text-slate-900">{shop.name}</h2>{shop.is_verified && <BadgeCheck aria-label="Verified shop" className="h-5 w-5 shrink-0 text-sky-600" />}</div><p className="mt-3 text-xs font-semibold text-slate-500">{shop.category}</p><p className="mt-2 flex items-start gap-2 text-sm text-slate-500"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{shop.city || shop.address || 'Local shop'}</span></p><p className="mt-4 flex items-center justify-between text-sm font-bold text-emerald-700"><span>{shop.product_count || 0} products</span><span className="inline-flex items-center gap-1">View catalog<ArrowUpRight className="h-4 w-4" /></span></p></button>)}</div>
    {(page > 1 || hasMore) && <div className="mt-6 flex items-center justify-between"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {page}</span><button disabled={!hasMore} onClick={() => setPage(page + 1)} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </>;
}
