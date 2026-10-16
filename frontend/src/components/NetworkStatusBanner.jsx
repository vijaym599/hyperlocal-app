import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';

export default function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [restored, setRestored] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const handleOffline = () => { clearTimeout(timer.current); setOnline(false); setRestored(false); };
    const handleOnline = () => {
      setOnline(true); setRestored(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setRestored(false), 4000);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => { clearTimeout(timer.current); window.removeEventListener('offline', handleOffline); window.removeEventListener('online', handleOnline); };
  }, []);

  if (online && !restored) return null;
  return <div role="status" aria-live="polite" className={`sticky top-[7.25rem] z-40 flex min-h-11 items-center justify-center gap-2 border-b px-4 py-2 text-center text-xs font-bold shadow-sm lg:top-16 ${online ? 'border-emerald-200 bg-emerald-50/95 text-emerald-800' : 'border-amber-200 bg-amber-50/95 text-amber-900'}`}>{online ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}{online ? 'Connection restored.' : 'You are offline. Some information may be unavailable.'}</div>;
}
