import {
  ArrowLeft, BarChart3, Check, Eye, MapPin, MessageCircle, PackageCheck,
  PhoneCall, ShieldCheck, Sparkles, Star, Store, X
} from 'lucide-react';

const plans = [
  {
    id: 'basic', name: 'Basic', eyebrow: 'Start small', price: 20,
    billed: '₹120 billed every 6 months', products: '10', verified: false, insights: false,
    bestFor: 'Home businesses and small neighbourhood shops',
    unlock: 'A complete digital storefront at the lowest starting cost',
    summary: 'A simple online catalog for a small neighbourhood shop.',
    highlights: [
      '10 products with image, price and brand',
      'Public shop page with a shareable link',
      'Nearby customer search discovery',
      'Call, WhatsApp and directions buttons',
      'Opening hours and live open/closed status',
      'Publish local offers and promotions',
      'Shop and product ratings & reviews',
      'CSV bulk upload and quick stock updates',
      'Standard business support'
    ]
  },
  {
    id: 'pro', name: 'Pro', eyebrow: 'Grow locally', price: 199,
    billed: 'Billed monthly', products: '100', verified: true, insights: true, recommended: true,
    bestFor: 'Active shops that want more trust and measurable leads',
    unlock: 'Verification plus a clear view of customer interest',
    summary: 'For active shops that want trust signals and customer insights.',
    highlights: [
      'Everything included in Basic',
      '100 product catalog capacity',
      'Verified Shop trust badge',
      'This-month and all-time activity reports',
      'Catalog views and unique visitor counts',
      'Call, WhatsApp and direction action totals',
      'Offer, review and sharing tools',
      'CSV catalog import and stock controls',
      'Standard business support'
    ]
  },
  {
    id: 'advance', name: 'Advance', eyebrow: 'Expand your catalog', price: 499,
    billed: 'Billed monthly', products: '300', verified: true, insights: true,
    bestFor: 'Established retailers managing a broad product range',
    unlock: 'Three times Pro catalog capacity with faster assistance',
    summary: 'For established stores with a larger and changing catalog.',
    highlights: [
      'Everything included in Pro',
      '300 product catalog capacity',
      'Verified Shop trust badge',
      'Customer activity and unique visitor reports',
      'High-volume CSV catalog management',
      'Product availability and quick stock controls',
      'Offers, reviews and direct contact tools',
      'Monthly and all-time performance totals',
      'Faster business support'
    ]
  },
  {
    id: 'enterprise', name: 'Enterprise', eyebrow: 'No catalog limit', price: 999,
    billed: 'Billed monthly', products: 'Unlimited', verified: true, insights: true,
    bestFor: 'Large catalogs, wholesalers and high-volume businesses',
    unlock: 'No product ceiling and the highest support priority',
    summary: 'For high-volume businesses that need room to keep growing.',
    highlights: [
      'Everything included in Advance',
      'Unlimited product catalog',
      'Verified Shop trust badge',
      'Full customer activity reporting',
      'Large CSV catalog management',
      'Product availability and stock controls',
      'Offers, reviews and direct customer actions',
      'Monthly and all-time performance totals',
      'Priority business support'
    ]
  }
];

const comparisonGroups = [
  {
    title: 'Catalog & discovery',
    rows: [
      { label: 'Maximum products', values: ['10', '100', '300', 'Unlimited'] },
      { label: 'Public shop page', values: [true, true, true, true] },
      { label: 'Nearby search discovery', values: [true, true, true, true] },
      { label: 'Product availability status', values: [true, true, true, true] },
      { label: 'Product images, brand and pricing', values: [true, true, true, true] },
      { label: 'Quick stock status updates', values: [true, true, true, true] },
      { label: 'Bulk CSV product import', values: [true, true, true, true] },
      { label: 'Offers and promotions', values: [true, true, true, true] }
    ]
  },
  {
    title: 'Customer actions',
    rows: [
      { label: 'Call shop button', values: [true, true, true, true] },
      { label: 'WhatsApp chat button', values: [true, true, true, true] },
      { label: 'Map and directions', values: [true, true, true, true] },
      { label: 'Customer reviews', values: [true, true, true, true] },
      { label: 'Shareable shop link', values: [true, true, true, true] },
      { label: 'Opening hours and open/closed status', values: [true, true, true, true] }
    ]
  },
  {
    title: 'Trust & reporting',
    rows: [
      { label: 'Verified Shop badge', values: [false, true, true, true] },
      { label: 'Customer activity report', values: [false, true, true, true] },
      { label: 'This month and total views', values: [false, true, true, true] },
      { label: 'Unique visitor count', values: [false, true, true, true] },
      { label: 'Calls, directions and WhatsApp counts', values: [false, true, true, true] }
    ]
  },
  {
    title: 'Plan terms',
    rows: [
      { label: 'Billing cycle', values: ['6 months', 'Monthly', 'Monthly', 'Monthly'] },
      { label: 'Amount charged per cycle', values: ['₹120', '₹199', '₹499', '₹999'] },
      { label: 'Business support', values: ['Standard', 'Standard', 'Faster', 'Priority'] },
      { label: 'Upgrade as the shop grows', values: [true, true, true, true] }
    ]
  }
];

const insightItems = [
  { icon: Eye, title: 'Shop opens', text: 'Customers who opened your shop catalog' },
  { icon: PhoneCall, title: 'Calls', text: 'Customers who tapped the Call button' },
  { icon: MapPin, title: 'Directions', text: 'Customers who requested directions' },
  { icon: MessageCircle, title: 'WhatsApp', text: 'Customers who started a chat' },
  { icon: Star, title: 'Reviews', text: 'Reviews included in total activity' }
];

const faqs = [
  { question: 'Is there a free shop plan?', answer: 'No. Basic is the lowest-priced shop plan at ₹20 per month equivalent, purchased as ₹120 for a 6-month term.' },
  { question: 'What is not included in Basic?', answer: 'Basic does not include the Verified Shop badge or the customer activity report. It also has a maximum of 10 products.' },
  { question: 'What does the customer activity report show?', answer: 'It shows shop opens, calls, direction requests, WhatsApp chats, reviews and total interactions for this month and all time. It does not reveal customer phone numbers or personal details.' },
  { question: 'Can I change my plan later?', answer: 'Yes. You can move to a larger plan as your catalog grows. A new paid term starts when the plan change is completed.' },
  { question: 'Does Enterprise include unlimited products?', answer: 'Yes. Enterprise has no catalog product-count limit in the application. Fair-use and technical safeguards still apply.' }
];

function Availability({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700"><Check className="h-4 w-4" aria-hidden="true" /><span className="sr-only sm:not-sr-only">Included</span></span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400"><X className="h-4 w-4" aria-hidden="true" /><span>Not included</span></span>;
  return <span className="font-bold text-slate-700">{value}</span>;
}

export default function PricingPage({ onBack, onStart }) {
  return (
    <section className="pb-16">
      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"><ArrowLeft className="h-4 w-4" />Back</button>
      </div>

      <header className="relative mt-6 overflow-hidden border-y border-slate-800 bg-slate-950 text-white">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><Store className="h-4 w-4" />Plans built for local shops</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Pay for the catalog size your shop needs.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">Every plan gives your business a public shop page and direct customer actions. Higher plans add more products, verification and clear activity insights.</p>
            <a href="#compare-plans" className="mt-7 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"><BarChart3 className="h-4 w-4" />Compare every feature</a>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl backdrop-blur sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Included in every plan</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {['Public shop page', 'Nearby discovery', 'Calls & WhatsApp', 'Maps & directions', 'Offers & reviews', 'Catalog management'].map((item) => <div key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="rounded-full bg-emerald-400/15 p-1 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>{item}</div>)}
            </div>
            <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-slate-400">No separate website builder is needed. Manage products and shop details with the same owner account.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <article key={plan.id} className={`relative flex flex-col overflow-hidden rounded-3xl border p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${plan.recommended ? 'border-emerald-500 bg-white ring-2 ring-emerald-100' : 'border-slate-200 bg-white'}`}>
              {plan.recommended && <div className="-mx-6 -mt-6 mb-5 bg-emerald-600 px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.16em] text-white"><Sparkles className="mr-1.5 inline h-3.5 w-3.5" />Most popular</div>}
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">{plan.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{plan.name}</h2>
              <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">{plan.summary}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Best for: {plan.bestFor}</p>
              <div className="mt-5 flex items-end gap-1"><span className="text-4xl font-black tracking-tight text-slate-950">₹{plan.price}</span><span className="pb-1 text-sm font-semibold text-slate-500">/ month</span></div>
              <p className="mt-1 text-xs font-semibold text-slate-500">{plan.billed}</p>
              <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-white"><p className="text-xs font-semibold text-slate-400">Catalog capacity</p><p className="mt-1 text-lg font-black">{plan.products} products</p></div>
              <div className="mt-4 space-y-2.5">
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${plan.verified ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>{plan.verified ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}Verified badge {plan.verified ? 'included' : 'not included'}</div>
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${plan.insights ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{plan.insights ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}Activity report {plan.insights ? 'included' : 'not included'}</div>
              </div>
              <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">What this plan unlocks</p><p className="mt-1 text-xs font-semibold leading-5 text-emerald-900">{plan.unlock}</p></div>
              <p className="mt-5 border-t border-slate-100 pt-5 text-xs font-black uppercase tracking-wider text-slate-500">Everything you get</p>
              <ul className="mt-3 flex-1 space-y-3">{plan.highlights.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>
              <button onClick={onStart} className={`mt-7 rounded-xl py-3 text-sm font-black transition ${plan.recommended ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>Choose {plan.name}</button>
            </article>
          ))}
        </div>

        <section className="mt-12 grid gap-6 rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-6 sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-violet-700">Pro and above</span>
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">Know how customers engage with your shop.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">View activity for this month and all time. Reports show action counts—not customer phone numbers or personal details.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{insightItems.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-violet-600" /><h3 className="mt-3 text-sm font-black text-slate-800">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>)}</div>
        </section>

        <section id="compare-plans" className="mt-16 scroll-mt-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Full comparison</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">See exactly what each plan includes.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">A green check means included. A grey cross explicitly means that feature is not available on that plan.</p>
          </div>

          <div className="mt-8 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-950 text-white">
                  <th className="sticky left-0 z-10 w-[280px] bg-slate-950 px-5 py-5 text-xs font-black uppercase tracking-wider">Feature</th>
                  {plans.map((plan) => <th key={plan.id} className={`min-w-[150px] px-4 py-5 text-center ${plan.recommended ? 'bg-emerald-700' : ''}`}><span className="block text-base font-black">{plan.name}</span><span className="mt-1 block text-xs font-medium text-slate-300">₹{plan.price}/month</span></th>)}
                </tr>
              </thead>
              <tbody>
                {comparisonGroups.map((group) => [
                  <tr key={`${group.title}-heading`}><th colSpan={5} className="bg-slate-100 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-slate-700">{group.title}</th></tr>,
                  ...group.rows.map((row) => <tr key={`${group.title}-${row.label}`} className="border-t border-slate-100 hover:bg-slate-50/70"><th className="sticky left-0 z-[1] bg-white px-5 py-4 font-semibold text-slate-700">{row.label}</th>{row.values.map((value, index) => <td key={`${row.label}-${plans[index].id}`} className={`px-4 py-4 text-center ${plans[index].recommended ? 'bg-emerald-50/40' : ''}`}><Availability value={value} /></td>)}</tr>)
                ])}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500 sm:hidden">Swipe sideways to compare all four plans.</p>
        </section>

        <section className="mt-16 overflow-hidden rounded-3xl bg-slate-950 text-white">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-7 sm:p-10 lg:border-b-0 lg:border-r">
              <PackageCheck className="h-8 w-8 text-emerald-400" />
              <h2 className="mt-5 text-3xl font-black">Start with the catalog you need today.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">Basic keeps the starting cost low. Pro adds the two growth tools Basic does not include: verification and activity reporting.</p>
              <button onClick={onStart} className="mt-7 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400">Create your shop</button>
            </div>
            <div className="grid gap-4 p-7 sm:grid-cols-2 sm:p-10">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"><ShieldCheck className="h-6 w-6 text-sky-400" /><h3 className="mt-4 font-black">Need a trust badge?</h3><p className="mt-2 text-sm leading-6 text-slate-400">Choose Pro, Advance or Enterprise. Basic does not include verification.</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"><BarChart3 className="h-6 w-6 text-violet-400" /><h3 className="mt-4 font-black">Need activity insights?</h3><p className="mt-2 text-sm leading-6 text-slate-400">Choose Pro or above to see shop opens and customer action totals.</p></div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-16 max-w-3xl">
          <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Questions</p><h2 className="mt-3 text-3xl font-black text-slate-950">Pricing FAQs</h2></div>
          <div className="mt-7 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            {faqs.map((faq) => <details key={faq.question} className="group p-5 open:bg-slate-50 sm:p-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-slate-800"><span>{faq.question}</span><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-lg text-slate-600 transition group-open:rotate-45">+</span></summary><p className="mt-3 pr-10 text-sm leading-6 text-slate-600">{faq.answer}</p></details>)}
          </div>
        </section>

        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-xs leading-5 text-amber-900"><strong>Launch note:</strong> Secure online subscription checkout is being connected. Plan selection is available for comparison, but live payments must not be accepted through the demo billing flow.</div>
      </div>
    </section>
  );
}
