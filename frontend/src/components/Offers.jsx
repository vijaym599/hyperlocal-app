import { useEffect, useState } from 'react';
import { BadgeCheck, CalendarDays, MapPin, Phone, Store, Tag } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { trackShopActivity } from '../activity.mjs';

const formatOfferEndDate = (value) => {
  if (!value) return 'No end date set';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'End date unavailable' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Offers({ session, onOpenShop }) {
  const [offers, setOffers] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    const loadOffers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/offers`, { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load offers.');
        setOffers(data.offers || []);
        setState('ready');
      } catch (error) {
        if (error.name !== 'AbortError') setState(error.message || 'Unable to load offers.');
      }
    };
    void loadOffers();
    return () => controller.abort();
  }, []);

  if (state === 'loading') return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-sm text-slate-500">Loading local offers…</div>;
  if (state !== 'ready') return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-sm text-rose-600">{state}</div>;

  return <section className="mx-auto max-w-6xl px-3 py-3 sm:px-8 sm:py-6">
    <header className="rounded-3xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-5 text-white shadow-lg sm:p-10">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold"><Tag className="h-4 w-4" />Local shop offers</span>
      <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Today’s offers near you</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-orange-50">Browse offers published directly by local shops. Contact the shop to confirm stock and offer terms.</p>
    </header>
    {!offers.length ? <div className="mt-8 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center"><Tag className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 font-bold text-slate-700">No active offers right now</h2><p className="mt-1 text-sm text-slate-500">Check again soon—local shops can add new offers anytime.</p></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {offers.map((offer) => <article key={offer.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-rose-50 to-orange-50 p-5">
          <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-extrabold text-white">{offer.discount_text || 'Special offer'}</span>
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">{offer.title}</h2>
          {offer.description && <p className="mt-2 text-sm leading-6 text-slate-600">{offer.description}</p>}
          <p className={`mt-4 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${offer.valid_until ? 'bg-white/80 text-slate-700' : 'bg-amber-100 text-amber-800'}`}><CalendarDays className="h-3.5 w-3.5" />Offer ends: {formatOfferEndDate(offer.valid_until)}</p>
        </div>
        <div className="p-4 sm:p-5"><button type="button" onClick={() => onOpenShop?.({ id: offer.shop_id, name: offer.shop_name, address: offer.address, category: offer.shop_category })} className="flex max-w-full items-center gap-2 text-left font-bold text-slate-800 hover:text-emerald-700"><Store className="h-4 w-4 shrink-0 text-emerald-600" /><span className="break-words">{offer.shop_name}</span>{offer.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-600" />}</button><p className="mt-2 flex items-start gap-1 break-words text-xs leading-5 text-slate-500"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{offer.address || offer.shop_category || 'Local shop'}</p><div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><button type="button" onClick={() => onOpenShop?.({ id: offer.shop_id, name: offer.shop_name, address: offer.address, category: offer.shop_category })} className="rounded-xl border border-emerald-200 py-2.5 text-xs font-bold text-emerald-700 sm:col-span-2">View shop</button>{offer.phone && <a href={`tel:${String(offer.phone).replace(/[^+\d]/g, '')}`} onClick={() => trackShopActivity('call', offer.shop_id, { session, source: 'offers' })} className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Phone className="h-3.5 w-3.5" />Call shop</a>}<a href={offer.latitude && offer.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${offer.latitude},${offer.longitude}` : offer.google_map_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${offer.shop_name} ${offer.address || ''}`)}`} onClick={() => trackShopActivity('directions', offer.shop_id, { session, source: 'offers' })} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"><MapPin className="h-3.5 w-3.5" />Directions</a></div></div>
      </article>)}
    </div>}
  </section>;
}
