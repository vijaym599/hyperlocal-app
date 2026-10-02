import { API_BASE_URL } from './config.js';

const trackedPages = new Set(['explore', 'offers', 'shop-portfolio', 'customer-auth', 'activity', 'my-shop', 'about', 'privacy', 'terms', 'report-issue', 'pricing']);
let memoryVisitorId = '';

const makeVisitorId = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16); globalThis.crypto?.getRandomValues?.(bytes);
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return [...bytes].map((value, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${value.toString(16).padStart(2, '0')}`).join('');
};

const visitorId = () => {
  if (memoryVisitorId) return memoryVisitorId;
  try {
    const stored = localStorage.getItem('nearbuy-visitor-id');
    if (/^[0-9a-f-]{36}$/.test(stored || '')) return (memoryVisitorId = stored);
    memoryVisitorId = makeVisitorId(); localStorage.setItem('nearbuy-visitor-id', memoryVisitorId); return memoryVisitorId;
  } catch { memoryVisitorId = makeVisitorId(); return memoryVisitorId; }
};

export function trackPageVisit(pageName) {
  if (!trackedPages.has(pageName)) return;
  const now = Date.now();
  try {
    const previous = JSON.parse(sessionStorage.getItem('nearbuy-last-page-visit') || '{}');
    if (previous.pageName === pageName && now - Number(previous.time || 0) < 30 * 60 * 1000) return;
    sessionStorage.setItem('nearbuy-last-page-visit', JSON.stringify({ pageName, time: now }));
  } catch { /* analytics must never interrupt the app */ }
  void fetch(`${API_BASE_URL}/api/analytics/visit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
    body: JSON.stringify({ visitor_id: visitorId(), page_name: pageName }),
  }).catch(() => {});
}
