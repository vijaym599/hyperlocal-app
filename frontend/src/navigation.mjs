export const DISPLAY_TABS = new Set([
  'shop-directory', 'explore', 'offers', 'assistant', 'shop-portfolio',
  'customer-auth', 'activity', 'my-shop', 'about', 'privacy', 'terms',
  'report-issue', 'demand', 'pricing',
]);

export const TAB_ACCESS = {
  explore: ['guest', 'customer'],
  'shop-directory': ['guest', 'customer'],
  assistant: ['guest', 'customer'],
  offers: ['guest', 'customer'],
  'shop-portfolio': ['guest', 'customer', 'shop_owner', 'admin'],
  'customer-auth': ['guest'],
  activity: ['customer'],
  'my-shop': ['guest', 'shop_owner'],
  'report-issue': ['guest', 'customer', 'shop_owner'],
  demand: ['admin'],
};

export const CUSTOMER_NAVIGATION = [
  { id: 'discover', label: 'Discover', tab: 'explore' },
  { id: 'shops', label: 'Shops', tab: 'shop-directory', matches: ['shop-directory', 'shop-portfolio'] },
  { id: 'offers', label: 'Offers', tab: 'offers' },
  { id: 'ask', label: 'Ask', longLabel: 'Ask Nearbuy', tab: 'assistant' },
  { id: 'account', label: 'You', tab: 'activity', guestTab: 'customer-auth', matches: ['activity', 'customer-auth'] },
];

const safeTab = (value) => DISPLAY_TABS.has(value) ? value : null;
const safeSection = (value) => /^[a-z][a-z0-9-]{0,40}$/.test(value || '') ? value : null;

export function routeFromLocation(locationLike) {
  const search = new URLSearchParams(locationLike?.search || '');
  const shopValue = search.get('shop') || '';
  const shopMatch = /^(?:\d+|.+-(\d+))$/.exec(shopValue);
  const shopId = shopMatch ? Number(shopMatch[1] || shopValue) : null;
  const validShopId = Number.isSafeInteger(shopId) && shopId > 0 && shopId <= 2147483647 ? shopId : null;
  const referral = (search.get('ref') || '').trim();
  return {
    tab: validShopId ? 'shop-portfolio' : referral ? 'my-shop' : safeTab(search.get('view')),
    section: safeSection(search.get('section')),
    shopId: validShopId,
  };
}

export function navigationUrl(locationLike, { tab, section, shopId } = {}) {
  const url = new URL(locationLike?.href || String(locationLike || 'http://localhost/'));
  url.searchParams.delete('view');
  url.searchParams.delete('section');
  url.searchParams.delete('shop');
  if (tab === 'shop-portfolio' && shopId) url.searchParams.set('shop', String(shopId));
  else if (safeTab(tab) && tab !== 'explore') url.searchParams.set('view', tab);
  if (safeSection(section)) url.searchParams.set('section', section);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function navigationItems(role) {
  if (role !== 'guest' && role !== 'customer') return [];
  return CUSTOMER_NAVIGATION.map((item) => ({
    ...item,
    target: role === 'guest' && item.guestTab ? item.guestTab : item.tab,
    matches: item.matches || [item.tab],
  }));
}
