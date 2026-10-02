import { useState } from 'react';
import { Package } from 'lucide-react';

export default function ProductImage({ product, className = '' }) {
  const source = typeof product.image_url === 'string' ? product.image_url.trim() : '';
  return <ImageContent key={source} source={source} name={product.name} className={className} />;
}

function ImageContent({ source, name, className }) {
  const [failed, setFailed] = useState(false);
  if (!source || failed) return <div role="img" aria-label={`${name || 'Product'} — image unavailable`} className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 to-slate-100 text-emerald-700 ${className}`}><Package aria-hidden="true" className="h-12 w-12 opacity-60" /><span className="text-[10px] text-slate-400">Image unavailable</span></div>;
  return <img src={source} alt={name || 'Product'} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`bg-slate-50 object-contain p-2 ${className}`} />;
}
