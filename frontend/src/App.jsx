import { useState } from 'react';
import Navbar from './components/Navbar';
import NearbySearch from './components/NearbySearch';
import MyShop from './components/MyShop';
import AboutContent from './components/AboutContent';
import DemandDashboard from './components/DemandDashboard';
import Footer from './components/Footer';
import LegalContent from './components/LegalContent';
import ReportIssue from './components/ReportIssue';

export default function App() {
  // 'explore', 'my-shop', or 'about'
  const [activeTab, setActiveTab] = useState('explore'); 
  
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
  };

  const handleLogout = () => {
    localStorage.removeItem('hyperlocal-session');
    setSession(null);
  };

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-800 flex flex-col">
      {/* Navigation Bar */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        session={session}
        onLogout={handleLogout}
      />

      {/* Dynamic Content based on activeTab */}
      <main className="flex-grow py-5 sm:py-8">
        {activeTab === 'explore' && <NearbySearch session={session} />}
        
        {activeTab === 'my-shop' && (
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

        {activeTab === 'demand' && <DemandDashboard session={session} />}
      </main>

      {/* Common Footer Component with setActiveTab prop */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}
