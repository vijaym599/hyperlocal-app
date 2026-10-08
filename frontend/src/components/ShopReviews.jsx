import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageSquareText, Star } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { readApiResponse } from '../apiResponse.mjs';
import { getRole } from '../session.mjs';

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ShopReviews({ shop, session, onRequireLogin, onSummaryChange }) {
  const [summary, setSummary] = useState({ average_rating: shop.average_rating || 0, review_count: shop.review_count || 0 });
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reviews/shop/${shop.id}`, { cache: 'no-store' });
      const data = await readApiResponse(response);
      setSummary(data.summary || { average_rating: 0, review_count: 0 });
      setReviews(data.reviews || []);
      onSummaryChange?.(data.summary || { average_rating: 0, review_count: 0 });
      setError('');
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [shop.id, onSummaryChange]);

  useEffect(() => {
    // The state updates happen after the review request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/reviews/shop/${shop.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ rating, comment })
      });
      const data = await readApiResponse(response);
      setNotice(data.message || 'Review saved.'); setComment('');
      await load();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };

  const isCustomer = getRole(session) === 'customer';

  return <section id="shop-reviews" className="mt-7 scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Customer feedback</p><h2 className="mt-2 text-2xl font-black text-slate-900">Shop reviews</h2><p className="mt-1 text-sm text-slate-500">Ratings from signed-in customer accounts.</p></div><div className="rounded-2xl bg-amber-50 px-4 py-3 text-right"><p className="flex items-center gap-1 text-xl font-black text-amber-800"><Star className="h-5 w-5 fill-amber-400 text-amber-400" />{Number(summary.average_rating || 0).toFixed(1)}/5</p><p className="text-xs font-semibold text-amber-700">{summary.review_count || 0} reviews</p></div></div>

    <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        {isCustomer ? <form onSubmit={submit} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><h3 className="font-black text-emerald-950">Rate this shop</h3><p className="mt-1 text-xs leading-5 text-emerald-800">Submitting again updates your previous review.</p><div className="mt-4 flex gap-1" aria-label="Choose rating">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" aria-label={`${value} star rating`} aria-pressed={rating === value} onClick={() => setRating(value)} className="rounded-lg p-1.5 transition hover:bg-white"><Star className={`h-6 w-6 ${value <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</div><label className="mt-4 block text-xs font-bold text-slate-600">Your review (optional)<textarea rows={4} maxLength={500} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Describe product availability, service or overall experience (optional)" className="mt-2 w-full resize-none rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm" /></label><div className="mt-1 text-right text-[11px] text-slate-400">{comment.length}/500</div><button disabled={saving} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}{saving ? 'Saving…' : 'Save review'}</button></form> : !session?.token ? <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-5"><h3 className="font-black text-slate-900">Visited this shop?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Sign in with a customer account to add a rating and review.</p><button type="button" onClick={onRequireLogin} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">Sign in to review</button></div> : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h3 className="font-black text-slate-900">Customer reviews only</h3><p className="mt-2 text-sm leading-6 text-slate-600">Shop owners and administrators can read reviews but cannot submit them.</p></div>}
        {notice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      </div>

      <div><h3 className="font-black text-slate-900">Latest reviews</h3>{loading ? <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading reviews…</p> : !reviews.length ? <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">No reviews yet. Be the first customer to review this shop.</div> : <div className="mt-4 space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-800">{review.owner_name || 'Customer'}</p><div className="mt-1 flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={`h-3.5 w-3.5 ${value <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div></div><time className="text-xs text-slate-400">{formatDate(review.created_at)}</time></div>{review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{review.comment}</p>}</article>)}</div>}</div>
    </div>
  </section>;
}
