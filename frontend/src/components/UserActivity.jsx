import { useEffect, useState } from 'react';
import { Clock3, MapPinned, Phone, Star } from 'lucide-react';
import { API_BASE_URL } from '../config';

const icon = { review: Star, call: Phone, directions: MapPinned };
const label = { review: 'Reviewed', call: 'Called', directions: 'Opened directions to' };

export default function UserActivity({ session }) {
  const [activities, setActivities] = useState([]); const [state, setState] = useState('loading');
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/activity`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => { setActivities(data.activities || []); setState('ready'); })
      .catch(() => setState('error'));
  }, [session.token]);
  return <section className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
    <h1 className="text-2xl font-bold text-slate-800">My activity</h1><p className="mt-1 text-sm text-slate-500">Your reviews and shop interactions.</p>
    {state === 'loading' && <p className="mt-8 text-sm text-slate-500">Loading activity…</p>}
    {state === 'error' && <p className="mt-8 text-sm text-rose-600">Could not load your activity. Please try again.</p>}
    {state === 'ready' && !activities.length && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No activity yet. Explore nearby shops to get started.</div>}
    <div className="mt-5 space-y-3">{activities.map((item) => { const Icon = icon[item.action_type] || Clock3; const target = item.product_name || item.shop_name || item.details?.shop_name || 'a shop'; return <div key={item.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><Icon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-800">{label[item.action_type] || 'Visited'} <span className="text-emerald-700">{target}</span></p>{item.action_type === 'review' && <p className="mt-0.5 text-xs text-slate-500">{item.details?.rating || 0} star rating</p>}<p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p></div></div>; })}</div>
  </section>;
}
