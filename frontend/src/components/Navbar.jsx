import { useState } from 'react';
import { Store, Compass, PlusCircle, Menu, X, LogOut, User, BarChart3, LogIn, Tag, Sparkles, House, Search, BellRing, Building2, CircleUserRound } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab, session, role, onLogout, onCustomerAuth }) => {
  const [isOpen, setIsOpen] = useState(false);
  const homeTab = role === 'admin' ? 'demand' : role === 'shop_owner' ? 'my-shop' : 'explore';
  const signedInLabel = role === 'shop_owner'
    ? session?.shop?.name || session?.shop?.shop_name || session?.user?.owner_name || session?.user?.name || 'My Shop'
    : session?.user?.name || session?.user?.owner_name || 'User';
  const accountTab = role === 'admin' ? 'demand' : role === 'shop_owner' ? 'my-shop' : 'activity';
  const hasCustomerDock = role === 'guest' || role === 'customer';
  const mobileItems = [
    { id: 'home', label: 'Home', icon: House, target: 'explore', matches: ['explore'] },
    { id: 'search', label: 'Shop AI', icon: Search, target: 'assistant', matches: ['assistant'] },
    { id: 'offers', label: 'Offers', icon: BellRing, target: 'offers', matches: ['offers'] },
    { id: 'business', label: 'Business', icon: Building2, target: role === 'guest' ? 'my-shop' : 'shop-directory', matches: ['my-shop', 'shop-directory', 'shop-portfolio'] },
    { id: 'profile', label: 'Profile', icon: CircleUserRound, target: role === 'guest' ? 'customer-auth' : 'activity', matches: ['customer-auth', 'activity'] },
  ];
  const navigateMobile = (target) => {
    if (target === 'customer-auth') onCustomerAuth();
    else setActiveTab(target);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
    <nav className="sticky top-0 z-50 border-b border-white/60 bg-white/65 shadow-[0_10px_35px_rgba(15,23,42,0.07)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/55">
      <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between h-16">
          
          {/* App Logo & Name */}
          <div 
            onClick={() => setActiveTab(homeTab)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition"
          >
            <div className="rounded-xl border border-white/50 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 p-2 text-white shadow-lg shadow-emerald-700/20">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
              Nearbuy 
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <div className={`${hasCustomerDock ? 'hidden' : 'hidden md:flex'} items-center gap-3`}>
            {(role === 'guest' || role === 'customer') && <button
              onClick={() => setActiveTab('explore')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                activeTab === 'explore'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Compass className="w-4 h-4" />
              Explore
            </button>}

            {(role === 'guest' || role === 'customer') && <button onClick={() => setActiveTab('assistant')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'assistant' ? 'border border-violet-700 bg-violet-700 text-white shadow-sm' : 'border border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100'}`}><Sparkles className="h-4 w-4" />AI Assistant</button>}

            {(role === 'guest' || role === 'customer') && <button onClick={() => setActiveTab('offers')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'offers' ? 'border border-orange-700 bg-orange-700 text-white shadow-sm' : 'border border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100'}`}><Tag className="h-4 w-4" />Offers</button>}

            {(role === 'guest' || role === 'shop_owner') && <button
                onClick={() => setActiveTab('my-shop')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                    activeTab === 'my-shop'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
                >
              <PlusCircle className="w-4 h-4" />
              My Shop
            </button>}

            {session?.user?.is_admin && (
              <button
                onClick={() => setActiveTab('demand')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  activeTab === 'demand'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Admin Dashboard
              </button>
            )}
            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* Shop owners sign in from the My Shop portal only. */}
            {session?.token ? (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setActiveTab(accountTab)} className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition ${activeTab === accountTab ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  <User className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="block max-w-32 truncate text-xs font-bold">{signedInLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 px-2 py-1 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            ) : role === 'guest' ? <button onClick={onCustomerAuth} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><LogIn className="w-3.5 h-3.5" />Sign in</button> : null}
          </div>

          {hasCustomerDock && <div className="hidden items-center gap-2 md:flex">
            <div aria-label="Primary navigation" className="flex items-center rounded-[1.35rem] border border-white/15 bg-slate-950/90 p-1.5 shadow-[0_14px_35px_rgba(2,6,23,0.22)] backdrop-blur-2xl backdrop-saturate-150">
              {mobileItems.map(({ id, label, icon: Icon, target, matches }) => {
                const selected = matches.includes(activeTab);
                return <button key={id} type="button" onClick={() => navigateMobile(target)} aria-current={selected ? 'page' : undefined} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all duration-200 lg:px-4 ${selected ? 'bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300 text-slate-950 shadow-[0_7px_20px_rgba(52,211,153,0.28)]' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className="h-4 w-4" strokeWidth={selected ? 2.5 : 1.8} /><span>{label}</span></button>;
              })}
            </div>
            {session?.token && <button type="button" onClick={onLogout} title="Sign out" aria-label="Sign out" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/80 bg-white/60 text-rose-600 shadow-sm backdrop-blur-xl transition hover:border-rose-200 hover:bg-rose-50"><LogOut className="h-4 w-4" /></button>}
          </div>}

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            {!hasCustomerDock && <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && !hasCustomerDock && (
        <div className="md:hidden border-t border-slate-100 bg-slate-50 px-4 pt-3 pb-4 space-y-2">
          {(role === 'guest' || role === 'customer') && <button
            onClick={() => {
              setActiveTab('explore');
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === 'explore'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Compass className="w-4 h-4" />
            Explore
          </button>}

          {(role === 'guest' || role === 'customer') && <button onClick={() => { setActiveTab('assistant'); setIsOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'assistant' ? 'bg-violet-700 text-white' : 'bg-violet-50 text-violet-700 hover:bg-violet-100'}`}><Sparkles className="h-4 w-4" />AI Assistant</button>}

          {(role === 'guest' || role === 'customer') && <button onClick={() => { setActiveTab('offers'); setIsOpen(false); }} className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${activeTab === 'offers' ? 'bg-orange-700 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}><Tag className="h-4 w-4" />Offers</button>}

          {(role === 'guest' || role === 'shop_owner') && <button
            onClick={() => {
              setActiveTab('my-shop');
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
              activeTab === 'my-shop'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            My Shop
          </button>}

          {session?.user?.is_admin && (
            <button
              onClick={() => {
                setActiveTab('demand');
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition ${
                activeTab === 'demand'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Admin Dashboard
            </button>
          )}
          <div className="pt-2 border-t border-slate-200">
            {session?.token ? (
              <div className="flex items-center gap-2 px-2 py-1">
                <button type="button" onClick={() => { setActiveTab(accountTab); setIsOpen(false); }} className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left ${activeTab === accountTab ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-700'}`}>
                  <User className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="block min-w-0 truncate text-xs font-bold">{signedInLabel}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="shrink-0 text-xs font-bold text-rose-600 hover:underline"
                >
                  Sign out
                </button>
              </div>
            ) : role === 'guest' ? <button onClick={() => { onCustomerAuth(); setIsOpen(false); }} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Sign in</button> : null}
          </div>
        </div>
      )}

    </nav>

      {hasCustomerDock && <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] bg-gradient-to-t from-slate-950/20 via-slate-900/5 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-5 md:hidden">
        <div aria-label="Primary navigation" className="pointer-events-auto mx-auto flex h-[68px] max-w-md items-center justify-around rounded-[1.8rem] border border-white/90 bg-white/75 px-1 shadow-[0_18px_45px_rgba(15,23,42,0.28)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/68">
          {mobileItems.map(({ id, label, icon: Icon, target, matches }) => {
            const selected = matches.includes(activeTab);
            return <button key={id} type="button" onClick={() => navigateMobile(target)} aria-current={selected ? 'page' : undefined} className={`group flex h-full w-1/5 flex-col items-center justify-center text-center transition ${selected ? 'text-emerald-800' : 'text-slate-500'}`}>
              <span className={`flex items-center justify-center transition-all duration-200 ${selected ? '-mt-5 h-12 w-12 rounded-full border border-emerald-300/70 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 text-white ring-[5px] ring-white/85 shadow-[0_10px_25px_rgba(5,150,105,0.35)]' : 'h-8 w-8 rounded-xl group-hover:bg-white/60 group-active:scale-90'}`}><Icon className={selected ? 'h-5 w-5' : 'h-[19px] w-[19px]'} strokeWidth={selected ? 2.5 : 1.8} /></span>
              <span className={`mt-0.5 text-[8px] font-black uppercase tracking-tight ${selected ? 'text-emerald-800' : 'text-slate-500'}`}>{label}</span>
            </button>;
          })}
        </div>
      </div>}
    </>
  );
};

export default Navbar;
