import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, LocateFixed, MapPin, Send, ShieldCheck, Sparkles, Store, Loader2, Search } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ProductImage from './ProductImage';

const suggestions = [
  'Basmati rice under ₹500 within 10 km',
  'Available milk near me',
  '₹300 kulla snacks kattu',
  'அருகில் கிடைக்கும் காய்கறிகள் காட்டு',
];

const welcome = {
  role: 'assistant',
  text: 'Hi! I can search Nearbuy’s live catalog in Tamil, Tanglish, or English. Tell me the product, budget, or distance you prefer.',
  products: [],
};

const formatPrice = (value) => Number(value || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export default function CustomerAssistant({ onOpenShop }) {
  const [messages, setMessages] = useState([welcome]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationText, setLocationText] = useState('Choose location');
  const [locating, setLocating] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [area, setArea] = useState('');
  const [places, setPlaces] = useState([]);
  const [areaBusy, setAreaBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  const requestCurrentLocation = () => {
    setLocating(true); setError('');
    if (!navigator.geolocation) {
      setError('This browser does not support location services. Search an area or pincode instead.');
      setShowLocationPicker(true); setLocating(false); return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ lat: coords.latitude, lng: coords.longitude });
      setLocationText('Current location'); setShowLocationPicker(false); setLocating(false);
    }, () => {
      setError('Location permission was not available. Search an area or pincode instead.');
      setShowLocationPicker(true); setLocating(false);
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  useEffect(() => { requestCurrentLocation(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, busy]);

  const searchArea = async (event) => {
    event.preventDefault();
    if (area.trim().length < 2) return;
    setAreaBusy(true); setError(''); setPlaces([]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/location/search?${new URLSearchParams({ query: area.trim() })}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to find that area.');
      setPlaces(data.places || []);
      if (!data.places?.length) setError('No matching area found. Try a pincode or a nearby city name.');
    } catch (requestError) { setError(requestError.message); } finally { setAreaBusy(false); }
  };

  const choosePlace = (place) => {
    setLocation({ lat: Number(place.lat), lng: Number(place.lng) });
    setLocationText(place.name); setPlaces([]); setArea(''); setError(''); setShowLocationPicker(false);
  };

  const ask = async (event, suggestedPrompt) => {
    event?.preventDefault?.();
    const question = String(suggestedPrompt || input).trim();
    if (busy || question.length < 2) return;
    if (!location) {
      setError('Choose your current location, area, or pincode before asking the assistant.');
      setShowLocationPicker(true); return;
    }
    setMessages((current) => [...current, { role: 'user', text: question, products: [] }]);
    setInput(''); setBusy(true); setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/customer-assistant`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, lat: location.lat, lng: location.lng }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The assistant is unavailable.');
      setMessages((current) => [...current, { role: 'assistant', text: data.answer, products: data.products || [] }]);
    } catch (requestError) {
      setMessages((current) => [...current, { role: 'assistant', text: requestError.message || 'Unable to search right now.', products: [], failed: true }]);
    } finally { setBusy(false); }
  };

  return <div className="mx-auto w-full max-w-5xl px-3 sm:px-6">
    <section className="flex h-[calc(100dvh-13rem)] min-h-[500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)] md:h-[calc(100dvh-7.5rem)] md:min-h-[620px]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white"><Sparkles className="h-4 w-4" /></span>
          <div className="min-w-0 text-left"><h1 className="truncate text-sm font-black text-slate-900 sm:text-base">Nearbuy AI</h1><p className="hidden text-[11px] text-slate-500 sm:block">Local shopping assistant</p></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 sm:flex"><ShieldCheck className="h-3.5 w-3.5" />Read only</span>
          <button type="button" onClick={() => setShowLocationPicker((current) => !current)} aria-expanded={showLocationPicker} className="flex max-w-44 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-600" /><span className="truncate">{locationText}</span><ChevronDown className={`h-3.5 w-3.5 shrink-0 transition ${showLocationPicker ? 'rotate-180' : ''}`} /></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-8 sm:px-6">
          {messages.length === 1 && <div className="my-auto py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg"><Bot className="h-7 w-7" /></span>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">What can I help you find?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Ask in Tamil, Tanglish, or English. I’ll search products from active nearby shops.</p>
            <div className="mx-auto mt-7 grid max-w-2xl gap-2 sm:grid-cols-2">{suggestions.map((prompt) => <button type="button" key={prompt} onClick={(event) => ask(event, prompt)} disabled={busy} className="rounded-2xl border border-slate-200 bg-white p-3.5 text-left text-xs font-semibold leading-5 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50">{prompt}</button>)}</div>
            <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />Cannot edit products, send messages, change plans, or make payments</p>
          </div>}

          {messages.slice(1).map((message, index) => <div key={`${message.role}-${index}`} className={`mb-7 flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"><Sparkles className="h-3.5 w-3.5" /></span>}
            <div className={message.role === 'user' ? 'max-w-[85%] sm:max-w-xl' : 'min-w-0 max-w-[calc(100%-2.75rem)] flex-1'}>
              <div className={`text-left text-sm leading-6 ${message.role === 'user' ? 'rounded-3xl rounded-br-lg bg-slate-100 px-4 py-2.5 text-slate-900' : message.failed ? 'rounded-xl bg-rose-50 px-3 py-2 text-rose-700' : 'py-1 text-slate-700'}`}>{message.text}</div>
              {message.products?.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{message.products.map((product) => <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex gap-3 p-3"><ProductImage product={product} className="h-20 w-20 shrink-0 rounded-xl" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-900">{product.name}</h3><p className="mt-0.5 truncate text-[11px] font-semibold text-emerald-700">{product.shop_name}</p></div><p className="shrink-0 text-xs font-black text-slate-900">{formatPrice(product.price)}</p></div><div className="mt-2 flex flex-wrap gap-1 text-[9px] font-bold"><span className={`rounded-full px-2 py-1 ${product.availability_status === 'available' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{product.availability_status === 'available' ? 'Available' : 'Low stock'}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{Number(product.distance_km).toFixed(1)} km</span></div></div></div><button type="button" onClick={() => onOpenShop?.({ id: product.shop_id, name: product.shop_name, address: product.address, image_url: product.shop_image_url })} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-3 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"><Store className="h-3.5 w-3.5" />View shop</button></article>)}</div>}
            </div>
          </div>)}
          {busy && <div aria-live="polite" className="mb-7 flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white"><Sparkles className="h-3.5 w-3.5" /></span><div className="flex items-center gap-2 py-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Searching nearby shops…</div></div>}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="relative shrink-0 border-t border-slate-100 bg-white px-3 pb-3 pt-3 sm:px-6 sm:pb-4">
        <div className="relative mx-auto max-w-3xl">
          {showLocationPicker && <div className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 z-20 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl sm:left-auto sm:w-[380px]">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-slate-900">Search location</p><p className="mt-0.5 text-[11px] text-slate-500">Used only to find nearby products</p></div><button type="button" onClick={requestCurrentLocation} disabled={locating} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50">{locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}Current</button></div>
            <form onSubmit={searchArea} className="mt-3 flex gap-2"><input value={area} onChange={(event) => setArea(event.target.value)} maxLength={120} placeholder="Area or pincode" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-emerald-400" /><button aria-label="Search area" disabled={areaBusy || area.trim().length < 2} className="rounded-xl bg-slate-900 px-3 text-white disabled:opacity-40">{areaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</button></form>
            {places.length > 0 && <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{places.map((place) => <button type="button" key={place.id} onClick={() => choosePlace(place)} className="w-full rounded-lg bg-slate-50 p-2.5 text-left text-[11px] leading-4 text-slate-700 hover:bg-emerald-50">{place.name}</button>)}</div>}
            {error && <p role="alert" className="mt-2 rounded-lg bg-rose-50 p-2.5 text-[11px] leading-4 text-rose-700">{error}</p>}
          </div>}

          <form onSubmit={ask} className="flex items-end gap-2 rounded-3xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-slate-400 focus-within:shadow-md"><button type="button" onClick={() => setShowLocationPicker((current) => !current)} aria-label="Choose search location" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${location ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><MapPin className="h-4 w-4" /></button><textarea rows="1" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(event); } }} maxLength={300} disabled={busy} placeholder="Message Nearbuy AI" className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400" /><button aria-label="Send message" disabled={busy || input.trim().length < 2} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200"><Send className="h-4 w-4" /></button></form>
          <p className="mt-2 text-center text-[10px] text-slate-400">Nearbuy AI uses shop-provided catalog data. Confirm price and stock before visiting.</p>
        </div>
      </footer>
    </section>
  </div>;
}
