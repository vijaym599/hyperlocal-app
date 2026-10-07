import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Check, MapPin, Search, Share2, Star, Store } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { shopShareLink } from '../shopLinks.mjs';
import ShopContact from './ShopContact';
import ProductImage from './ProductImage';
import ShopReviews from './ShopReviews';
import ShopImage from './ShopImage';

const statusStyle = { available: 'bg-emerald-50 text-emerald-700', low_stock: 'bg-amber-50 text-amber-700', out_of_stock: 'bg-rose-50 text-rose-700' };

export default function ShopPortfolio({ shopId, initialShop, onBack, onRequireLogin, session, backLabel = 'Back to nearby shops' }) {
  const [shop, setShop] = useState(initialShop?.name ? initialShop : null); const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [error, setError] = useState(''); const [shareNotice, setShareNotice] = useState('');
  useEffect(() => {
    if (!Number(shopId)) return;
    const controller = new AbortController();
    const loadPortfolio = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}/portfolio`, { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const data = await response.json(); setError(''); setShop(data.shop); setProducts(data.products || []); return;
        }
        throw new Error(response.status === 404 ? 'Shop could not be found.' : 'Unable to load this shop. Please try again.');
      } catch (err) { if (err.name !== 'AbortError') setError(err.message || 'Unable to load this shop.'); }
    };
    loadPortfolio();
    return () => controller.abort();
  }, [shopId, initialShop]);
  const visibleProducts = useMemo(() => { const term = query.trim().toLowerCase(); return !term ? products : products.filter((product) => [product.name, product.brand, product.description].some((value) => String(value || '').toLowerCase().includes(term))); }, [products, query]);
  const handleReviewSummary = useCallback((summary) => {
    setShop((currentShop) => currentShop ? { ...currentShop, average_rating: summary.average_rating, review_count: summary.review_count } : currentShop);
  }, []);
  const openReviews = () => document.getElementById('shop-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const shareShop = async () => {
    const link = shopShareLink(window.location.origin, shop);
    setShareNotice('');
    try {
      if (navigator.share) await navigator.share({ title: shop.name, text: `Browse products at ${shop.name}.`, url: link });
      else { await navigator.clipboard.writeText(link); setShareNotice('Link copied'); }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(link); setShareNotice('Link copied'); }
        catch { setShareNotice('Unable to share'); }
      }
    }
  };
  if (!Number(shopId) || error) return <div className="mx-auto max-w-5xl px-5 py-10"><button onClick={onBack} className="flex items-center gap-1 text-sm text-emerald-700"><ArrowLeft className="h-4 w-4" />Back</button><p className="mt-6 text-rose-600">{error || 'This shop does not have a valid catalog link.'}</p></div>;
  if (!shop) return <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-slate-500">Loading shop portfolio…</div>;
  return <section className="mx-auto max-w-6xl px-3 py-3 sm:px-8 sm:py-6">
    <button onClick={onBack} className="mb-3 flex min-h-10 items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" />{backLabel}</button>
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <ShopImage shop={shop} className="h-40 w-full object-cover sm:h-52 lg:h-full lg:min-h-[230px]" />
      <header className="bg-gradient-to-br from-emerald-700 to-teal-800 p-4 text-white sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><Store className="h-5 w-5 shrink-0" /><h1 className="truncate text-xl font-extrabold sm:text-2xl">{shop.name}</h1>{shop.is_verified && <BadgeCheck className="h-5 w-5 shrink-0 text-sky-200" />}</div>
            <p className="mt-1.5 flex items-start gap-1 text-xs leading-5 text-emerald-50 sm:text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="line-clamp-2">{shop.address || 'Local shop'}</span></p>
            {shop.opening_hours && <p className="mt-0.5 text-xs text-emerald-100 sm:text-sm">{shop.opening_hours}</p>}
          </div>
          <div className="shrink-0 rounded-xl bg-white/15 px-3 py-2 backdrop-blur"><p className="flex items-center gap-1 text-sm font-bold sm:text-base"><Star className="h-4 w-4 fill-amber-300 text-amber-300" />{Number(shop.average_rating || 0).toFixed(1)}/5</p><p className="text-[10px] text-emerald-100 sm:text-xs">{shop.review_count || 0} reviews</p></div>
        </div>
        <ShopContact shop={shop} session={session} action={<div className="ml-auto flex items-center gap-2">{shareNotice && <span role="status" className="text-xs font-semibold text-emerald-50">{shareNotice}</span>}<button type="button" onClick={openReviews} className="flex h-9 items-center gap-1.5 rounded-full border border-white/70 bg-white px-3 text-xs font-bold text-amber-700 shadow-sm transition hover:scale-105 hover:bg-amber-50"><Star className="h-4 w-4" />Rate</button><button type="button" onClick={shareShop} aria-label={`Share ${shop.name}`} title="Share this shop page" className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white text-emerald-700 shadow-sm transition hover:scale-105 hover:bg-emerald-50">{shareNotice === 'Link copied' ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}</button></div>} />
      </header>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">Shop catalog</h2><p className="mt-0.5 text-sm text-slate-500">{products.length} products listed by this shop</p></div><label className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this shop's products" className="w-full text-sm outline-none" /></label></div>
    {!visibleProducts.length ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No products match this shop search.</div> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><ProductImage product={product} className="h-44 w-full sm:h-48" /><div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-800">{product.name}</h3><span className="font-extrabold text-emerald-600">₹{product.price}</span></div>{product.brand && <p className="mt-1 text-xs font-semibold text-slate-500">{product.brand}</p>}<div className="mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusStyle[product.availability_status] || 'bg-slate-100 text-slate-600'}`}>{String(product.availability_status || 'available').replace('_', ' ')}</span><span className="flex items-center gap-1 text-xs font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(product.average_rating || 0).toFixed(1)}/5 ({product.review_count || 0})</span></div>{product.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{product.description}</p>}</div></article>)}</div>}
    <ShopReviews shop={shop} session={session} onRequireLogin={onRequireLogin} onSummaryChange={handleReviewSummary} />
  </section>;
}
