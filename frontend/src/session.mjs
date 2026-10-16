export const getRole = (session) => session?.user?.is_admin ? 'admin'
  : session?.user?.user_type === 'shop_owner' || session?.shop ? 'shop_owner'
    : session?.token ? 'customer' : 'guest';

export const homeTab = (session) => ({ admin: 'demand', shop_owner: 'my-shop' }[getRole(session)] || 'explore');

import { TAB_ACCESS } from './navigation.mjs';

export const resolveTab = (tab, session, portfolioShop) => {
  const role = getRole(session);
  if ((TAB_ACCESS[tab] && !TAB_ACCESS[tab].includes(role)) || (tab === 'shop-portfolio' && !portfolioShop)) return homeTab(session);
  return tab;
};
