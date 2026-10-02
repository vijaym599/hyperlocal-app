import { useState } from 'react';
import { shopShareLink } from '../shopLinks.mjs';

export default function ShopShare({ shop }) {
  const [notice, setNotice] = useState('');
  const link = shopShareLink(window.location.origin, shop);
  const share = async (copy = false) => {
    try {
      if (!copy && navigator.share) {
        await navigator.share({ title: shop.name, text: `Browse products at ${shop.name}.`, url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setNotice('Shop link copied.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') setNotice('Select and copy the link below.');
    }
  };
  return <section className="mb-6 rounded-2xl border border-emerald-200 bg-white p-5">
    <h2 className="text-lg font-bold">Share your shop</h2>
    <p className="mt-1 text-sm text-slate-500">Share your link so customers can browse your shop and product catalog.</p>
    <input aria-label="Shop link" readOnly value={link} onFocus={event => event.target.select()} className="mt-3 w-full rounded-lg border p-2 text-sm" />
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={() => share()} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Share shop</button>
      <button type="button" onClick={() => share(true)} className="rounded-xl border px-4 py-2 text-sm font-semibold">Copy link</button>
      <a href={link} target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 text-sm font-semibold">Preview shop</a>
    </div>
    {notice && <p role="status" className="mt-2 text-sm">{notice}</p>}
  </section>;
}
