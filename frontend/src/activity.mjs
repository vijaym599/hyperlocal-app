import { API_BASE_URL } from './config.js';
import { getVisitorId } from './analytics.mjs';

const customerSession = (session) => session?.token && session.user?.user_type === 'customer' && !session.user?.is_admin;

export function trackShopActivity(action, shopId, { session = null, productId = null, source = '', resultCount } = {}) {
  if (!Number(shopId)) return;
  if (session?.token && !customerSession(session)) return;
  const headers = { 'Content-Type': 'application/json' };
  if (customerSession(session)) headers.Authorization = `Bearer ${session.token}`;
  void fetch(`${API_BASE_URL}/api/activity/${action}`, {
    method: 'POST', headers, keepalive: true,
    body: JSON.stringify({
      shop_id: Number(shopId),
      product_id: Number(productId) || null,
      visitor_id: getVisitorId(),
      source,
      ...(Number.isInteger(resultCount) ? { result_count: resultCount } : {}),
    }),
  }).catch(() => {});
}
