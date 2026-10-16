import {
  BadgePercent,
  Bot,
  Building2,
  CircleUserRound,
  Compass,
  LogIn,
  Search,
  Store,
  UserRoundCog,
} from 'lucide-react';
import { navigationItems } from '../navigation.mjs';

const icons = {
  discover: Compass,
  shops: Building2,
  offers: BadgePercent,
  ask: Bot,
  account: CircleUserRound,
};

const pageNames = {
  explore: 'Discover nearby',
  'shop-directory': 'Local shops',
  offers: 'Offers',
  assistant: 'Ask Nearbuy',
  'shop-portfolio': 'Shop profile',
  'customer-auth': 'Customer account',
  activity: 'Your account',
  'my-shop': 'Shop workspace',
  demand: 'Administration',
  pricing: 'Pricing',
  about: 'About Nearbuy',
  privacy: 'Privacy',
  terms: 'Terms',
  'report-issue': 'Support',
};

export default function Navbar({ activeTab, setActiveTab, session, role, onCustomerAuth }) {
  const discoveryNavigation = role === 'guest' || role === 'customer';
  const items = navigationItems(role);
  const homeTab = role === 'admin' ? 'demand' : role === 'shop_owner' ? 'my-shop' : 'explore';
  const accountTab = role === 'admin' ? 'demand' : role === 'shop_owner' ? 'my-shop' : 'activity';
  const accountName = role === 'shop_owner'
    ? session?.shop?.name || session?.shop?.shop_name || session?.user?.owner_name || 'My Shop'
    : session?.user?.owner_name || session?.user?.name || (role === 'admin' ? 'Administrator' : 'Guest');

  const go = (target) => {
    if (target === 'customer-auth') onCustomerAuth();
    else setActiveTab(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navButton = (item, mobile = false) => {
    const Icon = icons[item.id];
    const selected = item.matches.includes(activeTab);
    return <button
      key={item.id}
      type="button"
      onClick={() => go(item.target)}
      aria-current={selected ? 'page' : undefined}
      className={`${mobile ? 'flex min-w-0 flex-col gap-0.5 px-1 py-2 text-[10px]' : 'flex gap-2 px-3 py-2 text-xs xl:px-4 xl:text-sm'} items-center justify-center rounded-xl font-bold transition ${selected ? 'neo-nav-active text-white' : 'text-slate-600 hover:bg-white/60 hover:text-emerald-800'}`}
    >
      <Icon className={mobile ? 'h-[18px] w-[18px] shrink-0' : 'h-4 w-4 shrink-0'} aria-hidden="true" />
      <span className="max-w-full truncate">{mobile ? item.label : item.longLabel || item.label}</span>
    </button>;
  };

  return <header className="neo-navbar sticky top-0 z-50 border-b border-white/60">
    <div className="mx-auto flex min-h-16 w-full max-w-[1800px] items-center justify-between gap-2 px-3 sm:px-5 lg:gap-5 lg:px-8">
      <button type="button" aria-label="Go to home" onClick={() => go(homeTab)} className="flex min-h-11 min-w-0 shrink items-center gap-2 rounded-xl text-left sm:shrink-0">
        <span className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-2 text-white shadow-lg shadow-emerald-900/15"><Store className="h-5 w-5" /></span>
        <span className="min-w-0"><span className="block truncate text-lg font-black tracking-tight text-slate-900">Nearbuy</span><span className="hidden truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:block">{pageNames[activeTab] || 'Local commerce'}</span></span>
      </button>

      {discoveryNavigation && <nav className="hidden min-w-0 items-center gap-1 rounded-2xl border border-white/60 bg-white/35 p-1.5 lg:flex" aria-label="Primary navigation">
        {items.map((item) => navButton(item))}
      </nav>}

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {activeTab !== 'explore' && discoveryNavigation && <button type="button" onClick={() => go('explore')} aria-label="Search products" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-white/60 xl:flex"><Search className="h-4 w-4" />Search</button>}
        {session?.token ? <button type="button" onClick={() => go(accountTab)} className="neo-inset flex min-h-11 max-w-44 items-center gap-2 rounded-xl border border-white/60 px-2.5 text-left text-xs font-bold text-slate-700 sm:px-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100/80 text-emerald-700">{role === 'admin' ? <UserRoundCog className="h-4 w-4" /> : <CircleUserRound className="h-4 w-4" />}</span><span className="hidden truncate md:block">{accountName}</span></button>
          : <button type="button" onClick={onCustomerAuth} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white shadow-lg shadow-emerald-900/15 sm:px-4"><LogIn className="h-4 w-4" /><span>Sign in</span></button>}
      </div>
    </div>

    {discoveryNavigation && <nav className="grid grid-cols-5 border-t border-white/50 bg-white/20 px-1.5 pb-[max(0.25rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Primary navigation">
      {items.map((item) => navButton(item, true))}
    </nav>}
  </header>;
}
