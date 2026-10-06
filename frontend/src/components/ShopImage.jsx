import { useState } from 'react';
import { Store } from 'lucide-react';

export default function ShopImage({ shop, className = '', label = 'Shop image' }) {
  const source = typeof shop?.image_url === 'string' ? shop.image_url.trim() : '';
  const [failedSource, setFailedSource] = useState('');

  if (!source || failedSource === source) return <div role="img" aria-label={`${shop?.name || 'Shop'} — image unavailable`} className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 ${className}`}><Store aria-hidden="true" className="h-10 w-10 opacity-70" /><span className="text-[10px] font-semibold text-emerald-800/60">Shop image</span></div>;

  return <img src={source} alt={`${shop?.name || label}`} loading="lazy" decoding="async" onError={() => setFailedSource(source)} className={className} />;
}
