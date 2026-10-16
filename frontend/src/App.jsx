import { lazy, Suspense, useEffect, useState } from 'react';
import { getRole, homeTab, resolveTab } from './session.mjs';
import { DISPLAY_TABS, navigationUrl, routeFromLocation } from './navigation.mjs';
import Navbar from './components/Navbar';
import NearbySearch from './components/NearbySearch';
import MyShop from './components/MyShop';
import AboutContent from './components/AboutContent';
import AdminDashboard from './components/AdminDashboard';
import Footer from './components/Footer';
import LegalContent from './components/LegalContent';
import ReportIssue from './components/ReportIssue';
import CustomerAuth from './components/CustomerAuth';
import UserActivity from './components/UserActivity';
import ShopPortfolio from './components/ShopPortfolio';
import ShopDirectory from './components/ShopDirectory';
import Offers from './components/Offers';
import { trackPageVisit } from './analytics.mjs';
import { applyTheme, getInitialTheme, getVisibleTheme, persistTheme } from './theme.mjs';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import { LoadingState, StatePanel } from './components/ui/StatePanel';

const PricingPage = lazy(() => import('./components/PricingPage'));
const CustomerAssistant = lazy(() => import('./components/CustomerAssistant'));

const readRoute = () => routeFromLocation(window.location);

export default function App() {
  const initialRoute = readRoute();
  const [theme, setTheme] = useState(getInitialTheme);
  const [requestedTab, setRequestedTab] = useState(initialRoute.tab);
  const [routeSection, setRouteSection] = useState(initialRoute.section);
  const [portfolioShop, setPortfolioShop] = useState(initialRoute.shopId ? { id: initialRoute.shopId } : null);
  const [postLoginTab, setPostLoginTab] = useState(null);
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hyperlocal-session')); }
    catch { return null; }
  });

  const role = getRole(session);
  const activeTab = resolveTab(requestedTab || homeTab(session), session, portfolioShop);
  const discoveryShell = role === 'guest' || role === 'customer';

  const navigate = (tab, options = {}) => {
    const nextShop = options.shop || (tab === 'shop-portfolio' ? portfolioShop : null);
    const section = options.section ?? null;
    if (nextShop) setPortfolioShop(nextShop);
    setRequestedTab(tab);
    setRouteSection(section);
    const url = navigationUrl(window.location, { tab, section, shopId: nextShop?.id });
    window.history[options.replace ? 'replaceState' : 'pushState']({ tab, section, shopId: nextShop?.id || null }, '', url);
  };

  useEffect(() => {
    const restoreRoute = () => {
      const next = readRoute();
      setRequestedTab(next.tab);
      setRouteSection(next.section);
      setPortfolioShop(next.shopId ? { id: next.shopId } : null);
    };
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);

  const handleLoginSuccess = (sessionData) => {
    localStorage.setItem('hyperlocal-session', JSON.stringify(sessionData));
    setSession(sessionData);
    navigate(postLoginTab || homeTab(sessionData), { replace: true });
    setPostLoginTab(null);
  };
  const handleLogout = () => {
    localStorage.removeItem('hyperlocal-session');
    setSession(null);
    navigate('explore', { replace: true });
  };
  const handleSessionUpdate = (nextSession) => {
    localStorage.setItem('hyperlocal-session', JSON.stringify(nextSession));
    setSession(nextSession);
  };
  const openShop = (shop) => {
    navigate('shop-portfolio', { shop });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const requireCustomerLogin = (returnTab = null) => {
    setPostLoginTab(returnTab);
    navigate('customer-auth');
  };
  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  const visibleTheme = getVisibleTheme(theme, role !== 'guest');
  useEffect(() => {
    applyTheme(visibleTheme);
    if (role !== 'guest') persistTheme(theme);
  }, [role, theme, visibleTheme]);
  useEffect(() => { if (role !== 'admin') trackPageVisit(activeTab); }, [activeTab, role]);

  return <div className={`flex min-h-[100dvh] flex-col bg-transparent font-sans text-slate-800 ${discoveryShell ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0' : ''}`}>
    <Navbar activeTab={activeTab} setActiveTab={navigate} session={session} role={role} onCustomerAuth={() => requireCustomerLogin(null)} />
    <NetworkStatusBanner />

    <div className={`flex min-w-0 flex-1 flex-col ${discoveryShell ? 'lg:pl-60' : ''}`}>
      <main id="main-content" className="min-w-0 flex-grow py-3 sm:py-8">
        {activeTab === 'shop-directory' && <ShopDirectory onBack={() => navigate(homeTab(session))} onOpenShop={openShop} />}
        {activeTab === 'explore' && discoveryShell && <NearbySearch session={session} onRequireLogin={() => requireCustomerLogin('explore')} onOpenShop={openShop} />}
        {activeTab === 'offers' && discoveryShell && <Offers session={session} onOpenShop={openShop} />}
        {activeTab === 'assistant' && discoveryShell && <Suspense fallback={<LoadingState label="Loading AI assistant…" className="mx-auto max-w-6xl" />}><CustomerAssistant onOpenShop={openShop} /></Suspense>}
        {activeTab === 'shop-portfolio' && portfolioShop && <ShopPortfolio session={session} key={portfolioShop.id} shopId={portfolioShop.id} initialShop={portfolioShop} backLabel={role === 'shop_owner' || role === 'admin' ? 'Back to dashboard' : 'Back to shops'} onBack={() => navigate(homeTab(session))} onRequireLogin={() => requireCustomerLogin('shop-portfolio')} />}
        {activeTab === 'customer-auth' && <CustomerAuth onLoginSuccess={handleLoginSuccess} onChooseShop={() => navigate('my-shop')} onBack={() => { navigate(postLoginTab || 'explore'); setPostLoginTab(null); }} />}
        {activeTab === 'activity' && role === 'customer' && <UserActivity session={session} onLogout={handleLogout} onSessionUpdate={handleSessionUpdate} theme={theme} onToggleTheme={toggleTheme} initialSection={routeSection} onSectionChange={(section) => navigate('activity', { section, replace: true })} />}
        {activeTab === 'my-shop' && (role === 'guest' || role === 'shop_owner') && <MyShop key={session?.token || 'guest'} session={session} onLoginSuccess={handleLoginSuccess} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} initialSection={routeSection} onSectionChange={(section) => navigate('my-shop', { section, replace: true })} />}
        {activeTab === 'about' && <AboutContent />}
        {activeTab === 'privacy' && <LegalContent type="privacy" onBack={() => navigate('explore')} />}
        {activeTab === 'terms' && <LegalContent type="terms" onBack={() => navigate('explore')} />}
        {activeTab === 'report-issue' && <ReportIssue session={session} role={role} onBack={() => navigate(homeTab(session))} onCustomerLogin={() => requireCustomerLogin('report-issue')} onShopLogin={() => { setPostLoginTab('report-issue'); navigate('my-shop'); }} />}
        {activeTab === 'demand' && role === 'admin' && <AdminDashboard session={session} onSessionExpired={handleLogout} theme={theme} onToggleTheme={toggleTheme} initialSection={routeSection} onSectionChange={(section) => navigate('demand', { section, replace: true })} />}
        {activeTab === 'pricing' && <Suspense fallback={<LoadingState label="Loading pricing plans…" className="mx-auto max-w-7xl" />}><PricingPage onBack={() => navigate(role === 'shop_owner' ? 'my-shop' : 'explore')} onStart={() => navigate('my-shop')} /></Suspense>}
        {!DISPLAY_TABS.has(activeTab) && <div className="mx-auto max-w-4xl px-4 py-8"><StatePanel kind="not-found" title="Page not found" description="The page you requested does not exist or is no longer available." primaryAction={{ label: 'Go home', onClick: () => navigate(homeTab(session)) }} /></div>}
      </main>
      <Footer setActiveTab={navigate} />
    </div>
  </div>;
}
