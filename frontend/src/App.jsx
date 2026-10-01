import { useState } from 'react';
import { getRole, homeTab, resolveTab } from './session.mjs';
import Navbar from './components/Navbar';
import NearbySearch from './components/NearbySearch';
import MyShop from './components/MyShop';
import AboutContent from './components/AboutContent';
import DemandDashboard from './components/DemandDashboard';
import Footer from './components/Footer';
import LegalContent from './components/LegalContent';
import ReportIssue from './components/ReportIssue';
import CustomerAuth from './components/CustomerAuth';
import UserActivity from './components/UserActivity';
import ShopPortfolio from './components/ShopPortfolio';
import PricingPage from './components/PricingPage';
import Offers from './components/Offers';

export default function App() {
  // Resolve the requested page against the current account's access.
  const [requestedTab, setActiveTab] = useState(null);
  const [portfolioShop, setPortfolioShop] = useState(null);
  
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hyperlocal-session'));
    } catch {
      return null;
    }
  });

  // My Shop owns shop-owner sign-in and registration.
  const handleLoginSuccess = (sessionData) => {
    localStorage.setItem('hyperlocal-session', JSON.stringify(sessionData));
    setSession(sessionData);
    setActiveTab(homeTab(sessionData));
  };

  const handleLogout = () => {
    localStorage.removeItem('hyperlocal-session');
    setSession(null);
    setActiveTab('explore');
  };

  const role = getRole(session);
  const activeTab = resolveTab(requestedTab || homeTab(session), session, portfolioShop);

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-800 flex flex-col">
      {/* Navigation Bar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        session={session}
        role={role}
        onLogout={handleLogout}
        onCustomerAuth={() => setActiveTab('customer-auth')}
      />

      {/* Dynamic Content based on activeTab */}
      <main className="flex-grow py-5 sm:py-8">
        {activeTab === 'explore' && (role === 'guest' || role === 'customer') && <NearbySearch session={session} onRequireLogin={() => setActiveTab('customer-auth')} onOpenShop={(shop) => { setPortfolioShop(shop); setActiveTab('shop-portfolio'); }} />}

        {activeTab === 'offers' && (role === 'guest' || role === 'customer') && <Offers />}

        {activeTab === 'shop-portfolio' && (role === 'guest' || role === 'customer') && portfolioShop && <ShopPortfolio shopId={portfolioShop.id} initialShop={portfolioShop} onBack={() => setActiveTab('explore')} />}

        {activeTab === 'customer-auth' && <CustomerAuth onLoginSuccess={handleLoginSuccess} onChooseShop={() => setActiveTab('my-shop')} onBack={() => setActiveTab('explore')} />}

        {activeTab === 'activity' && role === 'customer' && <UserActivity session={session} />}
        
        {activeTab === 'my-shop' && (role === 'guest' || role === 'shop_owner') && (
          <MyShop 
            key={session?.token || 'guest'}
            session={session} 
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'about' && <AboutContent />}

        {activeTab === 'privacy' && <LegalContent type="privacy" onBack={() => setActiveTab('explore')} />}

        {activeTab === 'terms' && <LegalContent type="terms" onBack={() => setActiveTab('explore')} />}

        {activeTab === 'report-issue' && <ReportIssue onBack={() => setActiveTab('explore')} />}

        {activeTab === 'demand' && role === 'admin' && <DemandDashboard session={session} />}

        {activeTab === 'pricing' && <PricingPage onBack={() => setActiveTab(role === 'shop_owner' ? 'my-shop' : 'explore')} onStart={() => setActiveTab('my-shop')} />}
      </main>

      {/* Common Footer Component with setActiveTab prop */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}
