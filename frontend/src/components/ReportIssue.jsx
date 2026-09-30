import { ArrowLeft, CircleAlert, Mail, MessageCircle } from 'lucide-react';

export default function ReportIssue({ onBack }) {
  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
      <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-900"><ArrowLeft className="h-4 w-4" /> Back to Nearbuy</button>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <span className="inline-flex rounded-2xl bg-amber-50 p-3 text-amber-600"><CircleAlert className="h-7 w-7" /></span>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-900">Report an issue</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Found an incorrect price, unavailable product, wrong shop location, or technical problem? Send the details so the listing can be reviewed.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href="mailto:support@nearbuy.com?subject=Nearbuy%20listing%20issue" className="rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:bg-emerald-50"><Mail className="h-5 w-5 text-emerald-600" /><h2 className="mt-3 font-bold text-slate-900">Email support</h2><p className="mt-1 text-sm text-slate-600">support@nearbuy.com</p></a>
          <div className="rounded-2xl border border-slate-200 p-5"><MessageCircle className="h-5 w-5 text-emerald-600" /><h2 className="mt-3 font-bold text-slate-900">Include these details</h2><p className="mt-1 text-sm leading-6 text-slate-600">Shop name, product name, what is incorrect, and a screenshot if available.</p></div>
        </div>
      </div>
    </section>
  );
}
