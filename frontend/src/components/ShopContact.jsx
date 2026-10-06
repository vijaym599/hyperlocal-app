import { MessageCircle, Navigation, PhoneCall } from 'lucide-react';
import { shopContactLinks } from '../shopContact.mjs';
import { API_BASE_URL } from '../config';

export default function ShopContact({ shop, session, action = null }) {
  const links = shopContactLinks(shop);
  const track = action => {
    if (!session?.token || session.user?.user_type !== 'customer' || session.user?.is_admin) return;
    fetch(`${API_BASE_URL}/api/activity/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ shop_id: shop.id }) }).catch(() => {});
  };
  return <div aria-label="Contact and visit shop" className="mt-5 border-t border-white/20 pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap gap-3">
        {links.call && <a href={links.call} onClick={() => track('call')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50"><PhoneCall className="h-4 w-4" />Call shop</a>}
        {links.whatsapp && <a href={links.whatsapp} onClick={() => track('whatsapp')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-800"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
        {links.directions && <a href={links.directions} onClick={() => track('directions')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"><Navigation className="h-4 w-4" />Get directions</a>}
      </div>
      {action}
    </div>
    {!links.call && !links.whatsapp && <p className="mt-3 text-xs text-emerald-100">This shop has not added contact numbers yet.</p>}
    {!links.directions && <p className="mt-3 text-xs text-emerald-100">This shop has not added its location yet.</p>}
  </div>;
}
