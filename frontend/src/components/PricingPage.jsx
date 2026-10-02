import { ArrowLeft, BarChart3, Check, Eye, MapPin, MessageCircle, PhoneCall, ShieldCheck, Sparkles, Star, Store, X } from 'lucide-react';

const plans = [
  {
    id: 'basic', name: 'Basic', price: 20, products: '10 products', verified: false, insights: false,
    summary: 'Minimum 6 months. ₹120 upfront (₹20/month). Upgrade anytime.',
    benefits: ['Your own shop page', 'Add and update up to 10 products', 'Customers can call or get directions']
  },
  {
    id: 'pro', name: 'Pro', price: 199, products: '100 products', verified: true, insights: true, recommended: true,
    summary: 'Best for active local shops that want more customers.',
    benefits: ['Everything in Basic', 'Verified Shop badge', 'Customer activity report: This month + Total']
  },
  {
    id: 'advance', name: 'Advance', price: 499, products: '300 products', verified: true, insights: true,
    summary: 'For larger shops with a growing catalog.',
    benefits: ['Everything in Pro', 'Add up to 300 products', 'Faster business support']
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 999, products: 'Unlimited products', verified: true, insights: true,
    summary: 'For businesses with a large, frequently updated catalog.',
    benefits: ['Everything in Advance', 'Unlimited product listings', 'Priority support']
  }
];

const insightItems = [
  { icon: Eye, title: 'Shop opens', text: 'How many customers opened your shop catalog' },
  { icon: PhoneCall, title: 'Calls', text: 'How many customers tapped Call' },
  { icon: MapPin, title: 'Directions', text: 'How many customers asked for directions' },
  { icon: MessageCircle, title: 'WhatsApp chats', text: 'How many customers started a WhatsApp chat' },
  { icon: Star, title: 'Reviews', text: 'Reviews are included in total customer activity' }
];

export default function PricingPage({ onBack, onStart }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"><ArrowLeft className="h-4 w-4" />Back</button>

      <div className="mt-7 overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><Store className="h-4 w-4" />Nearbuy plans for shop owners</span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-5xl">Get found by nearby customers.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">Choose a plan based on how many products you list. Upgrade any time when your shop grows.</p>
          <div className="mx-auto mt-6 max-w-2xl rounded-2xl border border-violet-300/25 bg-violet-400/10 p-4 text-left">
            <div className="flex items-center gap-2 font-bold text-violet-100"><BarChart3 className="h-5 w-5 text-violet-300" />Customer activity report — Pro and above</div>
            <p className="mt-1 text-sm leading-6 text-violet-100/80">See customer actions for <strong>This month</strong> or <strong>Total</strong>: shop opens, calls, directions, WhatsApp chats, reviews, and total interactions.</p>
          </div>
        <p className="mt-4 text-sm font-semibold text-emerald-100">Verified Shop badge is included in Pro, Advance, and Enterprise. It is not included in Basic.</p>
        </div>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <article key={plan.id} className={`relative flex flex-col rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${plan.recommended ? 'border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}>
            {plan.recommended && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-sm"><Sparkles className="mr-1 inline h-3 w-3" />Most popular</span>}
            <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-extrabold text-slate-900">{plan.name}</p><p className="mt-1 min-h-10 text-sm leading-5 text-slate-500">{plan.summary}</p></div>{plan.verified && <ShieldCheck className="h-6 w-6 shrink-0 text-sky-600" aria-label="Verified Shop badge included" />}</div>
            <p className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950">₹{plan.price}<span className="text-sm font-medium text-slate-500"> / month</span></p>
            <p className="mt-4 rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700">{plan.products === 'Unlimited products' ? 'Unlimited products' : `Up to ${plan.products}`}</p>
            <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${plan.verified ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>{plan.verified ? <><Check className="h-4 w-4 shrink-0" />Verified Shop badge included</> : <><X className="h-4 w-4 shrink-0" />Verified Shop badge not included</>}</div>
            <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${plan.insights ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{plan.insights ? <><Check className="h-4 w-4 shrink-0" />Customer activity report included</> : <><X className="h-4 w-4 shrink-0" />Customer activity report not included</>}</div>
            <ul className="mt-5 flex-1 space-y-3 border-t border-slate-100 pt-5">{plan.benefits.map((benefit) => <li key={benefit} className="flex gap-2 text-sm leading-5 text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{benefit}</li>)}</ul>
            <button onClick={onStart} className={`mt-7 rounded-xl py-3 text-sm font-extrabold transition ${plan.recommended ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>Choose {plan.name}</button>
          </article>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-violet-100 bg-violet-50/50 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-extrabold uppercase tracking-wider text-violet-700">Pro, Advance & Enterprise</p><h2 className="mt-2 text-2xl font-extrabold text-slate-900">What is in the customer activity report?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">It helps you understand whether customers are finding and contacting your shop. No customer phone number or personal details are shown.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700 shadow-sm">This month + Total</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{insightItems.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-violet-100 bg-white p-4"><Icon className="h-5 w-5 text-violet-600" /><h3 className="mt-3 text-sm font-extrabold text-slate-800">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div>
      </section>

      <section id="product-limits" className="mt-10 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 p-6"><h2 className="text-lg font-extrabold text-slate-800">Product limit by plan</h2><p className="mt-1 text-sm text-slate-500">This is the maximum number of products you can show in your online shop catalog.</p></div>
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">{plans.map((plan) => <div key={plan.id} className="p-5 text-center"><p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">{plan.name}</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{plan.products === 'Unlimited products' ? '∞' : plan.products.split(' ')[0]}</p><p className="text-xs text-slate-500">{plan.products === 'Unlimited products' ? 'Unlimited products' : 'products'}</p></div>)}</div>
      </section>
      <p className="mt-6 text-center text-xs text-slate-500">Payments are currently confirmed in the app’s demo billing flow. Connect a payment gateway before accepting real payments.</p>
    </section>
  );
}
