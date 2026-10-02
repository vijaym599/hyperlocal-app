import { API_BASE_URL } from './config';

const origin = (import.meta.env.VITE_SITE_URL || (import.meta.env.DEV ? API_BASE_URL : '')).replace(/\/$/, '');
const slug = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '');
export const shopUrl = (shop) => `${origin}/shop/${slug(`${shop.name} ${shop.address || ''}`) || 'shop'}-${shop.id}`;
export const productUrl = (product, shop) => `${origin}/product/${slug(`${product.name} ${shop?.address || product.shop_address || ''}`) || 'product'}-${product.id}`;
export const shopDirectoryUrl = `${origin}/shops`;
