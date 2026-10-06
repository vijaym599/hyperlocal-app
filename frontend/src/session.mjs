export const getRole = (session) => session?.user?.is_admin ? 'admin'
  : session?.user?.user_type === 'shop_owner' || session?.shop ? 'shop_owner'
    : session?.token ? 'customer' : 'guest';

export const homeTab = (session) => ({ admin: 'demand', shop_owner: 'my-shop' }[getRole(session)] || 'explore');

export const resolveTab = (tab, session, portfolioShop) => {
  const role = getRole(session);
  const access = {
    explore: ['guest', 'customer'], assistant: ['guest', 'customer'], offers: ['guest', 'customer'],
    'shop-portfolio': ['guest', 'customer', 'shop_owner', 'admin'], activity: ['customer'],
    'my-shop': ['guest', 'shop_owner'], demand: ['admin'],
  };
  if ((access[tab] && !access[tab].includes(role)) || (tab === 'shop-portfolio' && !portfolioShop)) return homeTab(session);
  return tab;
};
