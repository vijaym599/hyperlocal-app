import {
  ArrowUpRight,
  BadgeCheck,
  Compass,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShieldCheck,
  Store,
} from 'lucide-react';

function FooterLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-10 items-center gap-1.5 text-left text-sm text-slate-400 transition hover:text-emerald-300 focus-visible:outline focus-visible:outline-emerald-300"
    >
      <span className="min-w-0 break-words">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}

export default function Footer({ setActiveTab }) {
  const goTo = (tab) => () => { setActiveTab?.(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <footer className="relative mt-auto overflow-hidden bg-slate-950 text-slate-300">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 text-left sm:px-6 sm:py-10 lg:py-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          <div className="min-w-0 flex-1 basis-0 rounded-2xl bg-white/[0.035] p-3 sm:p-5">
            <button type="button" onClick={goTo('explore')} className="flex items-center gap-2.5 text-left">
              <span className="rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 p-2 text-slate-950 shadow-lg shadow-emerald-500/20">
                <Store className="h-5 w-5" />
              </span>
              <span className="text-xl font-black tracking-tight text-white">Nearbuy</span>
            </button>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
              Find the product near you. Check availability, visit the shop, and buy directly—without waiting for delivery.
            </p>
            <div className="mt-6 flex flex-wrap justify-start gap-2 text-center text-[11px] font-bold text-slate-300">
              <div className="w-[76px] rounded-xl bg-white/5 p-2.5"><MapPin className="mx-auto mb-1 h-4 w-4 text-emerald-300" />Nearby</div>
              <div className="w-[76px] rounded-xl bg-white/5 p-2.5"><BadgeCheck className="mx-auto mb-1 h-4 w-4 text-emerald-300" />Verified</div>
              <div className="w-[76px] rounded-xl bg-white/5 p-2.5"><Navigation className="mx-auto mb-1 h-4 w-4 text-emerald-300" />Direct</div>
            </div>
          </div>

          <div className="min-w-0 flex-1 basis-0 rounded-2xl bg-white/[0.035] p-3 sm:p-5">
            <h3 className="text-sm font-bold text-white">Discover</h3>
            <div className="mt-4 space-y-3">
              <FooterLink onClick={goTo('explore')}>Explore nearby products</FooterLink>
              <FooterLink onClick={goTo('shop-directory')}>Browse local shop catalogs</FooterLink>
              <FooterLink onClick={goTo('explore')}>Available products</FooterLink>
              <FooterLink onClick={goTo('about')}>How Nearbuy works</FooterLink>
            </div>
          </div>

          <div className="min-w-0 flex-1 basis-0 rounded-2xl bg-white/[0.035] p-3 sm:p-5">
            <h3 className="text-sm font-bold text-white">For businesses</h3>
            <div className="mt-4 space-y-3">
              <FooterLink onClick={goTo('my-shop')}>List your shop</FooterLink>
              <FooterLink onClick={goTo('pricing')}>Pricing &amp; plans</FooterLink>
              <FooterLink onClick={goTo('my-shop')}>Manage product catalog</FooterLink>
              <FooterLink onClick={goTo('my-shop')}>Update availability</FooterLink>
              <FooterLink onClick={goTo('about')}>Grow local visibility</FooterLink>
            </div>
          </div>

          <div className="min-w-0 flex-1 basis-0 rounded-2xl bg-white/[0.035] p-3 sm:p-5">
            <h3 className="text-sm font-bold text-white">Support &amp; trust</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <a href="mailto:support@nearbuy.com" className="flex min-w-0 items-start gap-2 break-all transition hover:text-emerald-300"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />support@nearbuy.com</a>
              <span className="flex items-center gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Contact shops directly</span>
              <span className="flex items-center gap-2"><MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />WhatsApp availability checks</span>
              <span className="flex items-center gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Shop verification program</span>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-3"><Compass className="h-5 w-5 shrink-0 text-emerald-300" /><p className="text-sm font-semibold text-white">Search. Confirm. Visit. Buy local.</p></div>
          <p className="text-xs leading-5 text-slate-500 sm:max-w-sm sm:text-right">Location, availability and price are supplied by listed shops.</p>
        </div>

        <div className="my-6 border-t border-white/10 sm:my-8" />

        <div className="flex flex-col items-start gap-4 text-xs text-slate-500 lg:flex-row lg:items-center lg:justify-between">
          <p className="leading-5">© {new Date().getFullYear()} Nearbuy. Built for local commerce.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <button type="button" onClick={goTo('about')} className="px-1 hover:text-slate-300">About</button>
            <button type="button" onClick={goTo('privacy')} className="px-1 hover:text-slate-300">Privacy</button>
            <button type="button" onClick={goTo('terms')} className="px-1 hover:text-slate-300">Terms</button>
            <button type="button" onClick={goTo('report-issue')} className="px-1 hover:text-slate-300">Report an issue</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
