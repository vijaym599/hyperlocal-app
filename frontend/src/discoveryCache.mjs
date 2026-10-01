const KEY = 'nearbuy-discovery-v1';
const TTL = 30 * 60 * 1000;
export const discoveryKey = (location, query = '', radius = '', availability = 'all', category = 'all') =>
  JSON.stringify([location?.lat, location?.lng, query, radius, availability, category]);
export function readDiscoveryCache(storage, api, now = Date.now()) {
  try {
    const value = JSON.parse(storage.getItem(KEY));
    if (!value || value.api !== api || !Number.isFinite(value.savedAt) || now - value.savedAt > TTL || value.savedAt > now) return null;
    if (!Number.isFinite(value.location?.lat) || Math.abs(value.location.lat) > 90 || !Number.isFinite(value.location?.lng) || Math.abs(value.location.lng) > 180) return null;
    if (!Array.isArray(value.results) || value.results.length > 10 || value.results.some((row) => !row || !row.id || !row.shop_id)) return null;
    return value;
  } catch { return null; }
}
export function writeDiscoveryCache(storage, api, location, data, now = Date.now()) {
  try {
    // Never cache base64 photos: a small first-page snapshot must fit localStorage.
    const results = data.results.slice(0, 10).map((row) => ({ ...row, image_url: row.image_url?.startsWith('data:') ? '' : row.image_url }));
    const value = JSON.stringify({ api, location, results, has_more: Boolean(data.has_more), savedAt: now });
    if (value.length <= 500000) storage.setItem(KEY, value);
  } catch { /* Storage may be unavailable or full; discovery still works. */ }
}

export function mergeProducts(previous, incoming) {
  const map = new Map(previous.map((product) => [product.id, product]));
  incoming.forEach((product) => map.set(product.id, product));
  return [...map.values()];
}
