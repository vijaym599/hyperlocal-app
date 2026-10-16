import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, Check, MapPin, Search, Share2, Star, Store } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { shopShareLink } from '../shopLinks.mjs';
import ShopContact from './ShopContact';
import ProductImage from './ProductImage';
import ShopReviews from './ShopReviews';
import ShopImage from './ShopImage';
import { trackShopActivity } from '../activity.mjs';
import { RequestError, requestError } from '../requestState.mjs';
import { EmptyState, ErrorState, FeedbackBanner, LoadingState } from './ui/StatePanel';

const statusStyle = { available: 'bg-emerald-50 text-emerald-700', low_stock: 'bg-amber-50 text-amber-700', out_of_stock: 'bg-rose-50 text-rose-700' };

export default function ShopPortfolio({ shopId, initialShop, onBack, onRequireLogin, session, backLabel = 'Back to nearby shops' }) {
  const [shop, setShop] = useState(initialShop?.name ? initialShop : null); const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [error, setError] = useState(null); const [shareNotice, setShareNotice] = useState(''); const [retry, setRetry] = useState(0);
  const [catalogPage, setCatalogPage] = useState({ total: 0, next_page: null }); const [loadingMore, setLoadingMore] = useState(false); const [catalogError, setCatalogError] = useState('');
  useEffect(() => {
    if (!Number(shopId)) return;
    const controller = new AbortController();
    const loadPortfolio = async (page = 1) => {
      if (page > 1) setLoadingMore(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}/portfolio?page=${page}&limit=24`, { cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const data = await response.json(); setError(null); setShop(data.shop); setProducts((current) => page === 1 ? (data.products || []) : [...current, ...(data.products || [])]); setCatalogPage(data.pagination || { total: data.products?.length || 0, next_page: null }); return;
        }
        throw requestError(response, response.status === 404 ? 'Shop could not be found.' : 'Unable to load this shop. Please try again.');
      } catch (err) { if (err.name !== 'AbortError') setError(err); }
      finally { if (!controller.signal.aborted) setLoadingMore(false); }
    };
    loadPortfolio();
    return () => controller.abort();
  }, [shopId, initialShop, retry]);
  useEffect(() => {
    trackShopActivity('view', shopId, { session, source: 'shop-portfolio' });
  }, [shopId, session]);
  const visibleProducts = useMemo(() => { const term = query.trim().toLowerCase(); return !term ? products : products.filter((product) => [product.name, product.brand, product.description].some((value) => String(value || '').toLowerCase().includes(term))); }, [products, query]);
  useEffect(() => {
    if (query.trim().length < 2) return undefined;
    const timer = window.setTimeout(() => trackShopActivity('search', shopId, { session, source: 'shop-catalog', resultCount: visibleProducts.length }), 600);
    return () => window.clearTimeout(timer);
  }, [query, session, shopId, visibleProducts.length]);
  const handleReviewSummary = useCallback((summary) => {
    setShop((currentShop) => currentShop ? { ...currentShop, average_rating: summary.average_rating, review_count: summary.review_count } : currentShop);
  }, []);
  const loadMoreProducts = async () => {
    if (!catalogPage.next_page || loadingMore) return;
    setLoadingMore(true); setCatalogError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}/portfolio?page=${catalogPage.next_page}&limit=24`, { cache: 'no-store' });
      if (!response.ok) throw requestError(response, 'Unable to load more products. Please try again.');
      const data = await response.json();
      setProducts((current) => [...current, ...(data.products || [])]);
      setCatalogPage(data.pagination || { total: products.length + (data.products?.length || 0), next_page: null });
    } catch (loadError) { setCatalogError(loadError); }
    finally { setLoadingMore(false); }
  };
  const openReviews = () => document.getElementById('shop-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const shareShop = async () => {
    const link = shopShareLink(window.location.origin, shop);
    setShareNotice('');
    trackShopActivity('share', shopId, { session, source: 'shop-portfolio' });
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
  if (!Number(shopId) || error) return <div className="mx-auto max-w-5xl px-5 py-10"><ErrorState error={error || new RequestError(404)} onRetry={Number(shopId) ? () => { setError(null); setRetry(value => value + 1); } : undefined} onBack={onBack} /></div>;
  if (!shop) return <div className="mx-auto max-w-5xl px-5 py-10"><LoadingState label="Loading shop portfolio…" rows={4} /></div>;
  return <section className="mx-auto max-w-6xl px-3 py-3 sm:px-8 sm:py-6">
    <button onClick={onBack} className="mb-3 flex min-h-10 items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"><ArrowLeft className="h-4 w-4" />{backLabel}</button>
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <ShopImage shop={shop} className="h-40 w-full object-cover sm:h-52 lg:h-full lg:min-h-[230px]" />
      <header className="bg-slate-950 p-4 text-white sm:p-5">
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
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-800">Shop catalog</h2><p className="mt-0.5 text-sm text-slate-500">{catalogPage.total || products.length} products listed by this shop</p></div><label className="flex w-full max-w-sm items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search loaded products by name or brand" className="w-full text-sm outline-none" /></label></div>
    {!visibleProducts.length ? <EmptyState kind={query.trim() ? 'search' : 'empty'} title={query.trim() ? 'No matching products' : 'This catalog is empty'} description={query.trim() ? `No products match “${query.trim()}”. Try another name or brand.` : 'This shop has not published any products yet.'} onAction={query.trim() ? () => setQuery('') : undefined} actionLabel="Clear search" className="mt-5" /> : <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><ProductImage product={product} className="h-44 w-full sm:h-48" /><div className="p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-800">{product.name}</h3><span className="font-extrabold text-emerald-600">₹{product.price}</span></div>{product.brand && <p className="mt-1 text-xs font-semibold text-slate-500">{product.brand}</p>}<div className="mt-3 flex items-center justify-between"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${statusStyle[product.availability_status] || 'bg-slate-100 text-slate-600'}`}>{String(product.availability_status || 'available').replace('_', ' ')}</span><span className="flex items-center gap-1 text-xs font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(product.average_rating || 0).toFixed(1)}/5 ({product.review_count || 0})</span></div>{product.description && <p className="mt-3 line-clamp-2 text-sm text-slate-500">{product.description}</p>}</div></article>)}</div>}
    {catalogError && <FeedbackBanner className="mt-4"><span>{catalogError.message || 'Unable to load more products.'}</span> <button type="button" onClick={loadMoreProducts} className="ml-2 font-bold underline">Retry</button></FeedbackBanner>}
    {catalogPage.next_page && <div className="mt-5 text-center"><button type="button" disabled={loadingMore} onClick={loadMoreProducts} className="rounded-xl border border-emerald-600 px-5 py-2.5 text-sm font-bold text-emerald-700 disabled:opacity-50">{loadingMore ? 'Loading products…' : 'Load more products'}</button></div>}
    <ShopReviews shop={shop} session={session} onRequireLogin={onRequireLogin} onSummaryChange={handleReviewSummary} />
  </section>;
}
