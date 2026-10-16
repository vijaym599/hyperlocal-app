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
  'customer-auth': 'Your account',
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

  const NavButton = ({ item, compact = false }) => {
    const Icon = icons[item.id];
    const selected = item.matches.includes(activeTab);
    return <button
      type="button"
      onClick={() => go(item.target)}
      aria-current={selected ? 'page' : undefined}
      className={`${compact ? 'flex h-full min-w-0 flex-1 flex-col justify-center gap-1 px-1 text-[10px]' : 'flex w-full items-center gap-3 px-4 py-3 text-sm'} rounded-2xl font-bold transition ${selected ? 'bg-emerald-700 text-white shadow-soft-sm' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'}`}
    >
      <Icon className={compact ? 'h-5 w-5' : 'h-[18px] w-[18px]'} aria-hidden="true" />
      <span className={compact ? 'max-w-full truncate' : ''}>{compact ? item.label : item.longLabel || item.label}</span>
    </button>;
  };

  return <>
    <header className="neo-navbar sticky top-0 z-50 border-b border-white/70 bg-white/80">
      <div className="mx-auto flex h-16 w-full max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <button type="button" aria-label="Go to home" onClick={() => go(homeTab)} className="flex min-h-11 items-center gap-2.5 rounded-xl text-left">
          <span className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-2 text-white shadow-soft-sm"><Store className="h-5 w-5" /></span>
          <span><span className="block text-lg font-black tracking-tight text-slate-900">Nearbuy</span><span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:block">{pageNames[activeTab] || 'Local commerce'}</span></span>
        </button>

        <div className="flex items-center gap-2">
          {activeTab !== 'explore' && discoveryNavigation && <button type="button" onClick={() => go('explore')} className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 sm:flex"><Search className="h-4 w-4" />Search products</button>}
          {session?.token ? <button type="button" onClick={() => go(accountTab)} className="flex min-h-11 max-w-48 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-xs font-bold text-slate-700 shadow-soft-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">{role === 'admin' ? <UserRoundCog className="h-4 w-4" /> : <CircleUserRound className="h-4 w-4" />}</span><span className="hidden truncate sm:block">{accountName}</span></button>
            : <button type="button" onClick={onCustomerAuth} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-soft-sm"><LogIn className="h-4 w-4" />Sign in</button>}
        </div>
      </div>
    </header>

    {discoveryNavigation && <aside className="neo-panel fixed bottom-5 left-4 top-20 z-40 hidden w-56 flex-col rounded-3xl border p-3 lg:flex" aria-label="Primary navigation">
      <div className="px-3 pb-3 pt-2"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Explore Nearbuy</p><p className="mt-1 text-sm font-semibold text-slate-600">Everything local, one tap away.</p></div>
      <nav className="space-y-1">{items.map((item) => <NavButton key={item.id} item={item} />)}</nav>
      <div className="mt-auto rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">Own a local shop?</p><button type="button" onClick={() => go('my-shop')} className="mt-2 flex w-full items-center gap-2 text-xs font-black text-emerald-700"><Store className="h-4 w-4" />List or manage it</button></div>
    </aside>}

    {discoveryNavigation && <nav className="neo-navbar fixed inset-x-2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] z-[70] flex h-[72px] items-stretch rounded-[1.6rem] border p-1.5 lg:hidden" aria-label="Primary navigation">
      {items.map((item) => <NavButton key={item.id} item={item} compact />)}
    </nav>}
  </>;
}
