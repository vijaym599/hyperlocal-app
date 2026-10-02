const slug = value => String(value || '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 160).replace(/-$/, '');

export const shopShareLink = (origin, shop) => {
  const name = slug(`${shop.name || ''} ${shop.city || ''}`) || 'shop';
  const url = new URL('/', origin);
  url.searchParams.set('shop', `${name}-${shop.id}`);
  return url.toString();
};

export const shopIdFromSearch = search => {
  const value = new URLSearchParams(search).get('shop') || '';
  const match = /^(?:\d+|.+-(\d+))$/.exec(value);
  const id = match ? Number(match[1] || value) : 0;
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
};
