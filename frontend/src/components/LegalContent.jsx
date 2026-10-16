import { ArrowLeft, FileText, LockKeyhole, MapPin, ShieldCheck } from 'lucide-react';

const legalContent = {
  privacy: {
    icon: LockKeyhole,
    eyebrow: 'Privacy',
    title: 'Your location stays in your control.',
    intro: 'Nearbuy uses your location only to help show products and shops near you. Location permission is optional and can be changed from your browser or device settings.',
    sections: [
      ['Information used', 'When you search, Nearbuy can use your approximate device location. Shop owners provide their shop details, contact information, and product listings.'],
      ['How it is used', 'Location helps calculate distance and show nearby results. Shop and product details are displayed to help customers contact or visit a shop directly.'],
      ['Your choices', 'You can deny location permission, use a manual location, or sign out from this device. Your sign-in session is stored in this browser so you remain signed in.'],
    ],
  },
  terms: {
    icon: FileText,
    eyebrow: 'Terms of use',
    title: 'Built to help customers buy from local shops.',
    intro: 'Nearbuy helps customers discover products in nearby shops. The final purchase, payment, delivery (if any), and customer service are handled directly by the customer and shop.',
    sections: [
      ['For customers', 'Confirm price, stock, condition, and shop timings with the shop before visiting. Product availability and prices are supplied by shop owners and may change.'],
      ['For shop owners', 'Keep shop details, product availability, and prices accurate. Only list products you are authorised to sell and provide a valid contact method for customers.'],
      ['Platform role', 'Nearbuy is a discovery platform. It does not process offline transactions or guarantee a shop’s stock, price, product quality, or service.'],
    ],
  },
};

export default function LegalContent({ type, onBack }) {
  const content = legalContent[type];
  const Icon = content.icon;

  return (
    <section className="mx-auto max-w-4xl px-5 py-10 sm:px-6 sm:py-14">
      <button type="button" onClick={onBack} className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-900">
        <ArrowLeft className="h-4 w-4" /> Back to Nearbuy
      </button>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-10 text-white sm:px-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider"><Icon className="h-3.5 w-3.5" />{content.eyebrow}</span>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{content.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50 sm:text-base">{content.intro}</p>
        </div>
        <div className="space-y-8 p-6 sm:p-10">
          {content.sections.map(([heading, body], index) => (
            <div key={heading} className="grid gap-3 sm:grid-cols-[2rem_1fr]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-700">{index + 1}</span>
              <div><h2 className="font-bold text-slate-900">{heading}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>
            </div>
          ))}
          {type === 'privacy' && <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />Location is used for nearby search only after you grant permission.</div>}
          {type === 'terms' && <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />For an incorrect listing, contact the shop first or report it from the support page.</div>}
        </div>
      </div>
    </section>
  );
}
