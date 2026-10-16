import { ArrowLeft, CircleAlert, LogIn, ShieldCheck, Store } from 'lucide-react';
import MyReports from './MyReports';

export default function ReportIssue({ session, role, onBack, onCustomerLogin, onShopLogin }) {
  const canSubmit = Boolean(session?.token && ['customer', 'shop_owner'].includes(role));

  return <section className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10">
    <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"><ArrowLeft className="h-4 w-4" />Back</button>
    <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
      <span className="inline-flex rounded-2xl bg-amber-400/15 p-3 text-amber-300"><CircleAlert className="h-7 w-7" /></span>
      <h1 className="mt-4 text-3xl font-black tracking-tight">Submit a complaint</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Tell us what happened. Your complaint is private and visible only to your account and Nearbuy administrators.</p>
    </header>
    {!canSubmit ? <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <ShieldCheck className="h-8 w-8 text-emerald-700" />
      <h2 className="mt-4 text-xl font-black text-slate-900">Sign in before submitting</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Only registered customers and shop owners can submit and track complaints. Signing in lets the admin verify the sender and respond safely.</p>
      <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={onCustomerLogin} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white"><LogIn className="h-4 w-4" />Customer sign in</button><button type="button" onClick={onShopLogin} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700"><Store className="h-4 w-4" />Shop-owner sign in</button></div>
    </div> : <div className="mt-6"><MyReports session={session} title="Your complaints" allowCreate /></div>}
  </section>;
}
