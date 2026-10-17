import {
  ArrowUpRight,
  BadgeCheck,
  CreditCard,
  LockKeyhole,
  Mail,
  MapPinned,
  Search,
  ShieldCheck,
  Store,
} from 'lucide-react';

function FooterLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="footer-link group flex min-h-9 items-center gap-1.5 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="min-w-0 break-words">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
    </button>
  );
}

function LocalSkyline() {
  return (
    <div className="footer-skyline" aria-hidden="true">
      <svg viewBox="0 0 1440 180" preserveAspectRatio="xMidYMax slice" className="block h-32 w-full sm:h-40 lg:h-44">
        <path d="M0 104C90 126 145 67 237 87c76 17 111 57 205 37 104-22 151-71 260-38 86 27 116 67 217 42 93-23 143-73 244-48 91 23 164 81 277 35v65H0z" fill="currentColor" />
        <g fill="currentColor">
          <path d="M21 88h13v28H21zm17-16h15v44H38zm20 9h10v35H58zm18-21h17v56H76zm22 13h10v43H98z" />
          <path d="M164 80c0-9 7-16 16-16s16 7 16 16v34h-32z" />
          <path d="M155 80h50l-7-13h-36z" />
          <circle cx="259" cy="75" r="10" /><rect x="255" y="82" width="8" height="35" />
          <circle cx="287" cy="91" r="8" /><rect x="284" y="96" width="6" height="28" />
          <path d="M356 81h16v44h-16zm21-25h19v69h-19zm24 39h14v30h-14zm19-53h23v83h-23zm28 25h14v58h-14z" />
          <path d="M525 68a16 16 0 1 1 32 0c0 13-16 33-16 33s-16-20-16-33zm13 32h6v23h-6z" />
          <path d="M646 82h75v47h-75zM656 69h55l10 13h-75z" />
          <path d="M658 91h14v11h-14zm22 0h14v11h-14zm22 0h10v11h-10zm-43 20h51v18h-51z" fill="#ffffff" opacity=".17" />
          <circle cx="782" cy="78" r="11" /><rect x="778" y="86" width="8" height="43" />
          <circle cx="817" cy="94" r="8" /><rect x="814" y="99" width="6" height="29" />
          <path d="M900 72h15v61h-15zm20 20h11v41h-11zm16-37h22v78h-22zm27 14h14v64h-14zm19 31h14v33h-14z" />
          <path d="M1070 95h92v40h-92zM1060 94l56-34 56 34z" />
          <path d="M1083 105h16v14h-16zm27 0h16v14h-16zm27 0h16v14h-16z" fill="#ffffff" opacity=".17" />
          <circle cx="1234" cy="77" r="12" /><rect x="1230" y="86" width="8" height="48" />
          <circle cx="1271" cy="96" r="8" /><rect x="1268" y="101" width="6" height="31" />
          <path d="M1350 76h16v61h-16zm21-18h21v79h-21zm26 31h12v48h-12zm17-43h19v91h-19z" />
        </g>
        <g fill="none" stroke="#ffffff" strokeWidth="3" opacity=".24">
          <path d="M119 105h67" /><path d="M1091 127h53" />
          <circle cx="864" cy="89" r="25" /><path d="M864 64v50M839 89h50M847 72l34 34M881 72l-34 34" />
        </g>
      </svg>
    </div>
  );
}

function TrustItem({ icon: Icon, title, note }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="footer-trust-icon grid h-10 w-10 shrink-0 place-items-center rounded-full"><Icon className="h-4 w-4" /></span><span><strong className="block text-xs font-bold text-white">{title}</strong><span className="footer-muted mt-0.5 block text-[11px] leading-4">{note}</span></span></div>;
}

export default function Footer({ setActiveTab }) {
  const goTo = (tab) => () => { setActiveTab?.(tab); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <footer className="ui-footer relative mt-16 sm:mt-20">
      <LocalSkyline />
      <div className="footer-surface">
        <div className="mx-auto max-w-7xl px-5 pb-8 pt-5 text-left sm:px-8 sm:pb-10 sm:pt-7 lg:px-10 lg:pb-8">
          <div className="grid gap-x-8 gap-y-10 border-b border-white/15 pb-10 sm:grid-cols-2 lg:grid-cols-12 lg:pb-12">
            <section className="sm:col-span-2 lg:col-span-4" aria-labelledby="footer-brand-title">
              <button type="button" onClick={goTo('explore')} className="group flex items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <span className="footer-brand-mark grid h-11 w-11 place-items-center rounded-2xl"><Store className="h-5 w-5" /></span>
                <span>
                  <span id="footer-brand-title" className="block text-xl font-black tracking-tight text-white">Nearbuy</span>
                  <span className="footer-eyebrow block text-[10px] font-bold uppercase tracking-[0.18em]">Shop local. Find nearby.</span>
                </span>
              </button>
              <p className="footer-copy mt-5 max-w-sm text-sm leading-6">Discover products available at nearby shops, confirm before visiting, and support local businesses directly.</p>
              <button type="button" onClick={goTo('explore')} className="footer-primary-action mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><Search className="h-4 w-4" />Discover nearby</button>
            </section>

            <section className="lg:col-span-2" aria-labelledby="footer-discover-title">
              <h2 id="footer-discover-title" className="footer-heading text-sm font-bold text-white">Discover</h2>
              <div className="mt-4 space-y-1">
                <FooterLink onClick={goTo('explore')}>Nearby products</FooterLink>
                <FooterLink onClick={goTo('shop-directory')}>Local shops</FooterLink>
                <FooterLink onClick={goTo('offers')}>Latest offers</FooterLink>
                <FooterLink onClick={goTo('about')}>How it works</FooterLink>
              </div>
            </section>

            <section className="lg:col-span-3" aria-labelledby="footer-business-title">
              <h2 id="footer-business-title" className="footer-heading text-sm font-bold text-white">For local businesses</h2>
              <div className="mt-4 space-y-1">
                <FooterLink onClick={goTo('my-shop')}>List your shop</FooterLink>
                <FooterLink onClick={goTo('my-shop')}>Manage your catalog</FooterLink>
                <FooterLink onClick={goTo('pricing')}>Pricing and plans</FooterLink>
                <FooterLink onClick={goTo('report-issue')}>Business support</FooterLink>
              </div>
            </section>

            <section className="lg:col-span-3" aria-labelledby="footer-contact-title">
              <h2 id="footer-contact-title" className="footer-heading text-sm font-bold text-white">Help and information</h2>
              <div className="mt-4 space-y-1">
                <a href="mailto:support@nearbuy.com" className="footer-link flex min-h-9 items-center gap-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"><Mail className="h-4 w-4 shrink-0" />support@nearbuy.com</a>
                <FooterLink onClick={goTo('report-issue')}>Submit a complaint</FooterLink>
                <FooterLink onClick={goTo('privacy')}>Privacy</FooterLink>
                <FooterLink onClick={goTo('terms')}>Terms</FooterLink>
              </div>
              <p className="footer-muted mt-5 flex items-start gap-2 text-xs leading-5"><MapPinned className="footer-accent mt-0.5 h-4 w-4 shrink-0" />Serving local communities across India.</p>
            </section>
          </div>

          <div className="grid gap-6 border-b border-white/15 py-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <TrustItem icon={BadgeCheck} title="Verified shops" note="Clear trust indicators" />
            <TrustItem icon={ShieldCheck} title="Direct connection" note="No marketplace middleman" />
            <TrustItem icon={LockKeyhole} title="Secure accounts" note="Protected sign-in flows" />
            <TrustItem icon={CreditCard} title="Flexible billing" note="UPI and card-ready plans" />
          </div>

          <div className="footer-legal flex flex-col items-start gap-4 pt-7 text-xs lg:flex-row lg:items-center lg:justify-between">
            <p>&copy; {new Date().getFullYear()} Nearbuy. Built for local commerce.</p>
            <p className="max-w-xl leading-5 lg:text-right">Availability, pricing, contact details and opening status are supplied by each listed shop. Confirm time-sensitive details before visiting.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
