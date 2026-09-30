import { useState } from 'react';
import { Store, Compass, PlusCircle, Menu, X, LogOut, User, BarChart3, Clock3, LogIn } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab, session, role, onLogout, onCustomerAuth }) => {
  const [isOpen, setIsOpen] = useState(false);
  const homeTab = role === 'admin' ? 'demand' : role === 'shop_owner' ? 'my-shop' : 'explore';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between h-16">
          
          {/* App Logo & Name */}
          <div 
            onClick={() => setActiveTab(homeTab)}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition"
          >
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 p-2 text-white shadow-lg shadow-emerald-600/20">
              <Store className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent">
              Nearbuy 
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-3">
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
                Demand
              </button>
            )}
            {role === 'customer' && (
              <button onClick={() => setActiveTab('activity')} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'activity' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'text-slate-600 hover:bg-slate-100'}`}><Clock3 className="w-4 h-4" />Activity</button>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* Shop owners sign in from the My Shop portal only. */}
            {session?.token ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  {session.user?.name || session.user?.email || 'User'}
                </span>
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

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
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
              Product Demand
            </button>
          )}
          {role === 'customer' && <button onClick={() => { setActiveTab('activity'); setIsOpen(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200/60"><Clock3 className="w-4 h-4" />My activity</button>}

          <div className="pt-2 border-t border-slate-200">
            {session?.token ? (
              <div className="flex justify-between items-center px-2 py-1">
                <span className="text-xs font-semibold text-slate-600">
                  {session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={onLogout}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Sign out
                </button>
              </div>
            ) : role === 'guest' ? <button onClick={() => { onCustomerAuth(); setIsOpen(false); }} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Sign in</button> : null}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
