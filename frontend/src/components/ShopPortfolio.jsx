import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, MapPin, Search, Star, Store } from 'lucide-react';
import { API_BASE_URL } from '../config';

const statusStyle = { available: 'bg-emerald-50 text-emerald-700', low_stock: 'bg-amber-50 text-amber-700', out_of_stock: 'bg-rose-50 text-rose-700' };

export default function ShopPortfolio({ shopId, initialShop, onBack }) {
  const [shop, setShop] = useState(initialShop || null); const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    if (!Number(shopId)) return;
    const loadPortfolio = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}/portfolio`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json(); setShop(data.shop); setProducts(data.products || []); return;
        }
        // Keep the catalog usable with servers that have not yet received the new portfolio route.
        const productsResponse = await fetch(`${API_BASE_URL}/api/shops/${shopId}/products`, { cache: 'no-store' });
        if (!productsResponse.ok) throw new Error('Shop could not be found.');
        const data = await productsResponse.json(); setProducts(Array.isArray(data.products) ? data.products : []);
        if (!initialShop) throw new Error('Shop details are unavailable.');
      } catch (err) { setError(err.message || 'Unable to load this shop.'); }
    };
    loadPortfolio();
  }, [shopId, initialShop]);
  const visibleProducts = useMemo(() => { const term = query.trim().toLowerCase(); return !term ? products : products.filter((product) => [product.name, product.brand, product.description].some((value) => String(value || '').toLowerCase().includes(term))); }, [products, query]);
  if (!Number(shopId) || error) return <div className="mx-auto max-w-5xl px-5 py-10"><button onClick={onBack} className="flex items-center gap-1 text-sm text-emerald-700"><ArrowLeft className="h-4 w-4" />Back</button><p className="mt-6 text-rose-600">{error || 'This shop does not have a valid catalog link.'}</p></div>;
  if (!shop) return <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Loading shop portfolio…</div>;
  return <section className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
    <button onClick={onBack} className="mb-5 flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" />Back to nearby shops</button>
    <header className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-800 p-6 text-white shadow-lg sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Store className="h-6 w-6" /><h1 className="text-2xl font-extrabold">{shop.name}</h1>{shop.is_verified && <BadgeCheck className="h-5 w-5 text-sky-200" />}</div><p className="mt-2 flex items-center gap-1 text-sm text-emerald-50"><MapPin className="h-4 w-4" />{shop.address || 'Local shop'}</p>{shop.opening_hours && <p className="mt-1 text-sm text-emerald-100">{shop.opening_hours}</p>}</div><div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur"><p className="flex items-center gap-1 text-lg font-bold"><Star className="h-4 w-4 fill-amber-300 text-amber-300" />{Number(shop.average_rating || 0).toFixed(1)}/5</p><p className="text-xs text-emerald-100">{shop.review_count || 0} shop reviews</p></div></div></header>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-800">Shop catalog</h2><p className="mt-1 text-sm text-slate-500">{products.length} products listed by this shop</p></div><label className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this shop's products" className="w-full text-sm outline-none" /></label></div>
    {!visibleProducts.length ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No products match this shop search.</div> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'} alt={product.name} loading="lazy" decoding="async" className="h-40 w-full object-cover" /><div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-800">{product.name}</h3><span className="font-extrabold text-emerald-600">₹{product.price}</span></div>{product.brand && <p className="mt-1 text-xs font-semibold text-slate-500">{product.brand}</p>}<div className="mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusStyle[product.availability_status] || 'bg-slate-100 text-slate-600'}`}>{String(product.availability_status || 'available').replace('_', ' ')}</span><span className="flex items-center gap-1 text-xs font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(product.average_rating || 0).toFixed(1)}/5 ({product.review_count || 0})</span></div>{product.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{product.description}</p>}</div></article>)}</div>}
  </section>;
}
