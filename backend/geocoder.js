const cache = new Map();
const placeCache = new Map();
let queue = Promise.resolve();
let lastRequest = 0;

const fetchJson = async (url, headers) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    const error = new Error(`Geocoding provider returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
};

// Share one queue between forward and reverse lookups; no provider autocomplete.
function geocode(parameters) {
  const key = parameters.toString();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < 30 * 60 * 1000) return Promise.resolve(cached.value);
  const task = queue.then(async () => {
    const current = cache.get(key);
    if (current && Date.now() - current.time < 30 * 60 * 1000) return current.value;
    const wait = Math.max(0, 1100 - (Date.now() - lastRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    const endpoint = parameters.has('q') || parameters.has('postalcode') ? 'search' : 'reverse';
    const value = await fetchJson(
      `${process.env.GEOCODER_BASE_URL || 'https://nominatim.openstreetmap.org'}/${endpoint}?${parameters}`,
      { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'Nearbuy-Hyperlocal/1.0', 'Accept-Language': 'en' }
    );
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(key, { value, time: Date.now() });
    return value;
  });
  queue = task.catch(() => {});
  return task;
}

const formatPhotonName = (properties) => {
  const parts = [properties.name, properties.street, properties.district, properties.city, properties.county, properties.state, properties.country]
    .filter(Boolean);
  return [...new Set(parts)].join(', ');
};

async function searchPlaces(query) {
  const normalized = String(query || '').trim();
  const cached = placeCache.get(normalized.toLowerCase());
  if (cached && Date.now() - cached.time < 30 * 60 * 1000) return cached.value;

  let places = [];
  try {
    const parameters = new URLSearchParams({ format: 'jsonv2', countrycodes: 'in', limit: '5' });
    parameters.set(/^\d{6}$/.test(normalized) ? 'postalcode' : 'q', normalized);
    const data = await geocode(parameters);
    places = (Array.isArray(data) ? data : []).map((place) => ({
      id: `nominatim-${place.place_id}`,
      name: place.display_name,
      lat: Number(place.lat),
      lng: Number(place.lon),
    }));
  } catch (error) {
    if (![403, 429].includes(error.status)) console.error('Primary area geocoder failed:', error.message);
  }

  if (!places.length) {
    const parameters = new URLSearchParams({ q: `${normalized}, India`, limit: '5', lang: 'en' });
    const data = await fetchJson(
      `${process.env.PHOTON_GEOCODER_BASE_URL || 'https://photon.komoot.io'}/api/?${parameters}`,
      { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'Nearbuy-Hyperlocal/1.0', 'Accept-Language': 'en' }
    );
    places = (Array.isArray(data.features) ? data.features : []).map((feature, index) => ({
      id: `photon-${feature.properties?.osm_type || 'place'}-${feature.properties?.osm_id || index}`,
      name: formatPhotonName(feature.properties || {}) || normalized,
      lat: Number(feature.geometry?.coordinates?.[1]),
      lng: Number(feature.geometry?.coordinates?.[0]),
      countryCode: String(feature.properties?.countrycode || '').toUpperCase(),
    })).filter((place) => !place.countryCode || place.countryCode === 'IN');
  }

  const value = places.filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lng));
  if (placeCache.size >= 500) placeCache.delete(placeCache.keys().next().value);
  placeCache.set(normalized.toLowerCase(), { value, time: Date.now() });
  return value;
}

module.exports = { geocode, searchPlaces };
