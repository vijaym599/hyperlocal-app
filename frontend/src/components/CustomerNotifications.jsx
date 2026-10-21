import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2, PackageCheck, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

const notificationTime = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};

export default function CustomerNotifications({ session, onOpenShop }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);
  const token = session?.token;
  const unread = notifications.filter((item) => !item.read_at).length;

  const load = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/customer/notifications`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) setNotifications((await response.json()).notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (!panelRef.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  const markAllRead = async () => {
    if (!unread) return;
    const response = await fetch(`${API_BASE_URL}/api/customer/notifications/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
  };

  const openNotification = (item) => {
    if (!item.read_at) {
      setNotifications((items) => items.map((notification) => notification.id === item.id ? { ...notification, read_at: new Date().toISOString() } : notification));
      void fetch(`${API_BASE_URL}/api/customer/notifications/${item.id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
    }
    setOpen(false);
    if (item.shop_id) onOpenShop?.({ id: item.shop_id, name: item.shop_name, address: item.address, image_url: item.image_url });
  };

  return <div ref={panelRef} className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); void load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} className="relative grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-700">
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[calc(100%+0.6rem)] z-[70] w-[min(23rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="font-black text-slate-900">Notifications</p><p className="text-[11px] text-slate-500">Products you asked us to watch</p></div><div className="flex items-center gap-1">{unread > 0 && <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"><CheckCheck className="h-3.5 w-3.5" />Read all</button>}<button type="button" onClick={() => setOpen(false)} aria-label="Close notifications" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div></div>
      <div className="max-h-[min(28rem,70vh)] overflow-y-auto p-2">{loading ? <p className="flex items-center justify-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading notifications…</p> : !notifications.length ? <div className="p-8 text-center"><Bell className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">You are all caught up</p><p className="mt-1 text-xs leading-5 text-slate-500">Use “Notify me” on a product and we will tell you when the shop confirms it.</p></div> : notifications.map((item) => <button type="button" key={item.id} onClick={() => openNotification(item)} className={`mb-1 flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 ${item.read_at ? '' : 'bg-emerald-50/70'}`}><span className={`mt-0.5 rounded-lg p-2 ${item.read_at ? 'bg-slate-100 text-slate-500' : 'bg-emerald-600 text-white'}`}><PackageCheck className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{item.title}</strong>{!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-600" />}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-1 block text-[10px] font-semibold text-slate-400">{notificationTime(item.created_at)}</span></span></button>)}</div>
    </div>}
  </div>;
}
