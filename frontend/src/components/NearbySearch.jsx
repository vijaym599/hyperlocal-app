import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Store, Package, Navigation, RefreshCw, Layers, ChevronLeft, ChevronRight, Phone, MessageCircle, BadgeCheck, Clock3, Heart, Share2, Star, X } from 'lucide-react';
import { productUrl, shopUrl } from '../publicUrls';
import ProductSkeleton from './ProductSkeleton';
import DistanceSelector from './DistanceSelector';
import { readDiscoveryCache, writeDiscoveryCache, discoveryKey } from '../discoveryCache.mjs';
import { API_BASE_URL } from '../config';
import ShopImage from './ShopImage';

// Instagram Story Style Categories Data
const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🛍️', bg: 'from-amber-400 to-pink-500' },
  { id: 'grocery', name: 'Grocery', icon: '🛒', bg: 'from-green-400 to-emerald-600' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥬', bg: 'from-lime-400 to-green-600' },
  { id: 'fashion', name: 'Fashion', icon: '👕', bg: 'from-purple-400 to-indigo-600' },
  { id: 'electronics', name: 'Electronics', icon: '📱', bg: 'from-blue-400 to-cyan-600' },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', bg: 'from-red-400 to-rose-600' },
  { id: 'bakery', name: 'Bakery', icon: '🎂', bg: 'from-orange-400 to-amber-600' },
  { id: 'restaurant', name: 'Food & Dining', icon: '🍽️', bg: 'from-red-400 to-orange-500' },
  { id: 'hardware', name: 'Hardware', icon: '🛠️', bg: 'from-slate-500 to-zinc-700' },
  { id: 'beauty', name: 'Beauty', icon: '💄', bg: 'from-pink-400 to-rose-600' },
  { id: 'home', name: 'Home Needs', icon: '🏠', bg: 'from-sky-400 to-blue-600' },
  { id: 'stationery', name: 'Stationery', icon: '✏️', bg: 'from-yellow-400 to-orange-500' },
  { id: 'jewellery', name: 'Jewellery', icon: '💍', bg: 'from-amber-300 to-yellow-600' },
  { id: 'automotive', name: 'Auto Care', icon: '🚗', bg: 'from-cyan-500 to-blue-700' },
  { id: 'pets', name: 'Pets', icon: '🐾', bg: 'from-violet-400 to-purple-600' },
  { id: 'education', name: 'Education', icon: '📚', bg: 'from-indigo-400 to-blue-600' },
  { id: 'fitness', name: 'Fitness', icon: '🏋️', bg: 'from-teal-400 to-emerald-600' },
  { id: 'services', name: 'Local Services', icon: '🤝', bg: 'from-fuchsia-400 to-pink-600' },
  { id: 'others', name: 'More', icon: '✨', bg: 'from-slate-400 to-slate-600' },
];

const PAGE_SIZE = 10;

const normaliseCategory = (value) => {
  const category = String(value || '').toLowerCase();
  if (category.includes('vegetable') || category.includes('fruit')) return 'vegetables';
  if (category.includes('cloth') || category.includes('fashion')) return 'fashion';
  if (category.includes('electronic') || category.includes('mobile')) return 'electronics';
  if (category.includes('pharmacy') || category.includes('health')) return 'pharmacy';
  if (category.includes('bakery')) return 'bakery';
  if (category.includes('food') || category.includes('dining') || category.includes('cafe') || category.includes('restaurant')) return 'restaurant';
  if (category.includes('hardware') || category.includes('electrical')) return 'hardware';
  if (category.includes('beauty') || category.includes('cosmetic') || category.includes('salon')) return 'beauty';
  if (category.includes('home') || category.includes('furniture')) return 'home';
  if (category.includes('stationery') || category.includes('book')) return 'stationery';
  if (category.includes('jewellery') || category.includes('jewelry')) return 'jewellery';
  if (category.includes('auto') || category.includes('vehicle') || category.includes('bike')) return 'automotive';
  if (category.includes('pet')) return 'pets';
  if (category.includes('education') || category.includes('tuition') || category.includes('school')) return 'education';
  if (category.includes('fitness') || category.includes('gym') || category.includes('sports')) return 'fitness';
  if (category.includes('service') || category.includes('repair') || category.includes('professional')) return 'services';
  if (category.includes('grocery') || category.includes('supermarket') || category.includes('general')) return 'grocery';
  return 'others';
};

// Helper: Calculate Distance in KM (Returns Number for Sorting)
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return Infinity;

  const R = 6371; // Earth Radius in KM
  const dLat = ((nLat2 - nLat1) * Math.PI) / 180;
  const dLon = ((nLon2 - nLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((nLat1 * Math.PI) / 180) *
      Math.cos((nLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper: Format Distance Number to UI Text (m or km)
const formatDistanceText = (distanceKm) => {
  if (distanceKm === Infinity || distanceKm === null || isNaN(distanceKm)) return null;
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

const availabilityPresentation = (status) => ({
  available: { label: 'Available', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  low_stock: { label: 'Low stock', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  out_of_stock: { label: 'Out of stock', className: 'bg-rose-50 text-rose-700 border-rose-200' }
}[status] || { label: 'Availability not updated', className: 'bg-slate-50 text-slate-600 border-slate-200' });

const RatingBadge = ({ rating, count, label, onClick }) => {
  const reviewCount = Number(count || 0);
  const content = <><Star className={`h-3.5 w-3.5 ${reviewCount ? 'fill-amber-400 text-amber-400' : ''}`} /> {reviewCount ? <>{Number(rating).toFixed(1)}<span className="font-medium text-amber-700/70">/5 ({reviewCount})</span></> : 'No ratings yet'}</>;
  const className = reviewCount ? 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800' : 'inline-flex items-center gap-1 text-[11px] font-medium text-slate-400';
  return onClick ? <button type="button" onClick={onClick} className={`${className} transition hover:scale-105 hover:bg-amber-100`} title={`See ${label.toLowerCase()} and reviews`}>{content}</button> : <span className={className} title={`${label}: ${reviewCount} review${reviewCount === 1 ? '' : 's'}`}>{content}</span>;
};

const formatUpdatedAt = (value) => {
  if (!value) return null;
  const updatedAt = new Date(value).getTime();
  if (Number.isNaN(updatedAt)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
};

const Pagination = ({ page, pageCount, setPage, itemName }) => {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
      <span className="font-medium text-slate-500">Page {page} of {pageCount} · {PAGE_SIZE} {itemName} per page</span>
      <div className="flex gap-2">
        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
        <button onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
};

const mapDiscoveryResults = (results) => {
  const uniqueShops = new Map();

  const extractedProducts = results.map((product) => {
    const category = normaliseCategory(product.shop_category);
    const distance = Number(product.distance_km);
    const shop = {
      id: product.shop_id,
      name: product.shop_name || 'Local Shop',
      address: product.address || 'Nearby',
      category,
      categoryLabel: product.shop_category || 'Other',
      phone: product.phone || null,
      whatsapp_number: product.whatsapp_number || null,
      opening_hours: product.opening_hours || null,
      is_open: Boolean(product.is_open),
      is_verified: Boolean(product.is_verified),
      average_rating: Number(product.shop_average_rating || 0),
      review_count: Number(product.shop_review_count || 0),
      lat: Number.isFinite(Number(product.latitude)) ? Number(product.latitude) : null,
      lng: Number.isFinite(Number(product.longitude)) ? Number(product.longitude) : null,
      backendDistance: Number.isFinite(distance) ? distance : null,
      image_url: product.shop_image_url || '',
      total_products: 0
    };
    const currentShop = uniqueShops.get(shop.id);
    uniqueShops.set(shop.id, { ...shop, total_products: (currentShop?.total_products || 0) + 1 });

    return {
      ...product,
      shop_name: shop.name,
      shop_id: shop.id,
      shop_lat: shop.lat,
      shop_lng: shop.lng,
      shop_address: shop.address,
      shop_phone: shop.phone,
      shop_whatsapp_number: shop.whatsapp_number,
      shop_is_open: shop.is_open,
      shop_is_verified: shop.is_verified,
      category,
      backendDistance: shop.backendDistance
    };
  });

  return { products: extractedProducts, shops: Array.from(uniqueShops.values()) };
};

const NearbySearch = ({ session, onRequireLogin, onOpenShop }) => {
  const [initialCache] = useState(() => readDiscoveryCache(localStorage, API_BASE_URL));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [radiusKm, setRadiusKm] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [requestPhone, setRequestPhone] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [existingReviews, setExistingReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [reviewTarget, setReviewTarget] = useState('product');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nearbuy-favorites')) || []; } catch { return []; }
  });
  
  const [shops, setShops] = useState(() => mapDiscoveryResults(initialCache?.results || []).shops);
  const [products, setProducts] = useState(() => mapDiscoveryResults(initialCache?.results || []).products);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(Boolean(initialCache?.has_more));
  const [productPage, setProductPage] = useState(1);
  const [cachedResults, setCachedResults] = useState(Boolean(initialCache));
  const [resultsKey, setResultsKey] = useState(() => discoveryKey(initialCache?.location));
  const [areaQuery, setAreaQuery] = useState('');
  const [areaPlaces, setAreaPlaces] = useState([]);
  const [areaError, setAreaError] = useState('');
  const [findingArea, setFindingArea] = useState(false);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const locationVersion = useRef(0);
  const areaController = useRef(null);
  const [searchError, setSearchError] = useState('');
  const searchController = useRef(null);
  const searchVersion = useRef(0);
  const [userLocation, setUserLocation] = useState(initialCache?.location || null);
  const usableLocationRef = useRef(initialCache?.location || null);
  const [locationError, setLocationError] = useState(null);
  const [placeName, setPlaceName] = useState(initialCache?.location?.name || 'Current location');
  const [gettingLocation, setGettingLocation] = useState(initialCache?.location?.source !== 'manual');
  const [shopPage, setShopPage] = useState(1);
  const categoryRailRef = useRef(null);

  const submitReview = async (event) => {
    event.preventDefault();
    if (!session?.token) { setReviewMessage('Please sign in with a customer account to add a review.'); onRequireLogin?.(); return; }
    const item = reviewItem || selectedProduct;
    if (!item) return;
    setSavingReview(true); setReviewMessage('');
    try {
      const id = reviewTarget === 'product' ? item.id : (item.shop_id || item.id);
      const response = await fetch(`${API_BASE_URL}/api/reviews/${reviewTarget}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ rating: reviewRating, comment: reviewComment }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save review.');
      setReviewMessage('Thanks! Your review has been saved.'); setReviewComment('');
      const latestReviewData = await loadReviews(reviewTarget, item);
      const summary = latestReviewData?.summary;
      if (summary) {
        const average = Number(summary.average_rating || 0);
        const count = Number(summary.review_count || 0);
        if (reviewTarget === 'product') {
          setProducts((current) => current.map((product) => product.id === item.id ? { ...product, product_average_rating: average, product_review_count: count } : product));
        } else {
          const shopId = item.shop_id || item.id;
          setProducts((current) => current.map((product) => product.shop_id === shopId ? { ...product, shop_average_rating: average, shop_review_count: count } : product));
          setShops((current) => current.map((shop) => shop.id === shopId ? { ...shop, average_rating: average, review_count: count } : shop));
        }
      }
      if (userLocation) fetchNearbyData(userLocation.lat, userLocation.lng, searchQuery, radiusKm, availableOnly ? 'available' : 'all', activeCategory, 1, userLocation);
    } catch (error) { setReviewMessage(error.message); } finally { setSavingReview(false); }
  };

  const loadReviews = async (target, item) => {
    if (!item) return;
    try {
      const id = target === 'product' ? item.id : (item.shop_id || item.id);
      const response = await fetch(`${API_BASE_URL}/api/reviews/${target}/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setReviewSummary(data.summary); setExistingReviews(data.reviews || []);
      return data;
    } catch { setReviewSummary(null); setExistingReviews([]); return null; }
  };

  const openReviews = (item, target = 'product') => {
    setReviewItem(item); setReviewTarget(target); setReviewMessage(''); setReviewComment('');
    loadReviews(target, item);
  };

  // Fetch a product-first, radius-limited result set from the server.
  const fetchNearbyData = useCallback(async (lat, lng, query = '', radius = '', availability = 'all', category = 'all', page = 1, location = null) => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const version = ++searchVersion.current;
    setLoading(true);
    setSearchError('');
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), query, availability, category, page: String(page), limit: String(PAGE_SIZE) });
      if (radius) params.set('radius', radius);
      const url = `${API_BASE_URL}/api/search/products?${params}`;

      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Search request failed with status ${res.status}`);

      const data = await res.json();
      if (version !== searchVersion.current) return;
      const results = Array.isArray(data.results) ? data.results : [];
      const mapped = mapDiscoveryResults(results);
      setProducts(mapped.products);
      setShops(mapped.shops);
      setHasMore(Boolean(data.has_more));
      setProductPage(page);
      setCachedResults(false);
      setResultsKey(discoveryKey({ lat, lng }, query, radius, availability, category));
      if (page === 1) setShopPage(1);
      if (page === 1 && !query && !radius && availability === 'all' && category === 'all') {
        writeDiscoveryCache(localStorage, API_BASE_URL, location || { lat, lng, source: 'gps' }, data);
      }
    } catch (err) {
      if (err.name === 'AbortError' || version !== searchVersion.current) return;
      setSearchError('Unable to search nearby products. Please try again.');
      console.error('Error fetching nearby products:', err);
    } finally {
      if (version === searchVersion.current) setLoading(false);
    }
  }, []);

  const getUserLocation = useCallback(() => {
    const version = ++locationVersion.current;
    setGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      if (!usableLocationRef.current) {
        setLocationError('Your browser does not support location services.');
        setShowAreaPicker(true);
      }
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (version !== locationVersion.current) return;
        const location = { lat: coords.latitude, lng: coords.longitude, source: 'gps' };
        usableLocationRef.current = location;
        setUserLocation(location);
        setLocationError(null);
        setPlaceName('Current location');
        setShowAreaPicker(false);
        setGettingLocation(false);
      },
      (error) => {
        if (version !== locationVersion.current) return;
        console.error('Location Error:', error);
        if (usableLocationRef.current) {
          setLocationError(null);
        } else {
          setLocationError('We could not get your location. Turn on GPS or choose an area.');
          setShowAreaPicker(true);
        }
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    if (initialCache?.location?.source === 'manual') return undefined;
    const locationTimer = window.setTimeout(getUserLocation, 0);
    return () => { window.clearTimeout(locationTimer); locationVersion.current += 1; };
  }, [getUserLocation, initialCache]);

  useEffect(() => {
    if (!userLocation) return undefined;
    const searchTimer = window.setTimeout(() => {
      fetchNearbyData(userLocation.lat, userLocation.lng, searchQuery, radiusKm, availableOnly ? 'available' : 'all', activeCategory, 1, userLocation);
    }, searchQuery ? 250 : 0);
    return () => {
      window.clearTimeout(searchTimer);
      searchController.current?.abort();
      searchVersion.current += 1;
    };
  }, [activeCategory, availableOnly, fetchNearbyData, radiusKm, searchQuery, userLocation]);

  useEffect(() => {
    if (!userLocation || userLocation.source === 'manual') return undefined;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/location/reverse?lat=${userLocation.lat}&lng=${userLocation.lng}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Location name unavailable')))
      .then((data) => setPlaceName(data.place_name || 'Current location'))
      .catch((error) => { if (error.name !== 'AbortError') console.error('Location name error:', error); });
    return () => controller.abort();
  }, [userLocation]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!userLocation || query.length < 2) return undefined;

    const controller = new AbortController();
    const suggestionTimer = window.setTimeout(() => {
      const params = new URLSearchParams({ lat: String(userLocation.lat), lng: String(userLocation.lng), query });
      if (radiusKm) params.set('radius', radiusKm);
      fetch(`${API_BASE_URL}/api/search/suggestions?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Suggestions unavailable')))
        .then((data) => setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []))
        .catch((error) => {
          if (error.name !== 'AbortError') console.error('Suggestion error:', error);
        });
    }, 180);

    return () => {
      window.clearTimeout(suggestionTimer);
      controller.abort();
    };
  }, [radiusKm, searchQuery, userLocation]);

  useEffect(() => () => { areaController.current?.abort(); }, []);

  const findArea = async (event) => {
    event.preventDefault();
    areaController.current?.abort();
    const controller = new AbortController();
    areaController.current = controller;
    setFindingArea(true); setAreaError(''); setAreaPlaces([]);
    try {
      const response = await fetch(`${API_BASE_URL}/api/location/search?${new URLSearchParams({ query: areaQuery.trim() })}`, { signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Area search failed (${response.status}). Please try again.`);
      if (controller.signal.aborted) return;
      setAreaPlaces(data.places || []);
      if (!data.places?.length) setAreaError('No area found. Try a nearby town or pincode.');
    } catch (error) {
      if (error.name !== 'AbortError') setAreaError(error.message);
    } finally { if (!controller.signal.aborted) setFindingArea(false); }
  };

  const chooseArea = (place) => {
    locationVersion.current += 1;
    searchController.current?.abort(); searchVersion.current += 1;
    setGettingLocation(false); setLocationError(null); setSearchError('');
    setProducts([]); setShops([]); setCachedResults(false); setHasMore(false);
    const location = { lat: place.lat, lng: place.lng, name: place.name, source: 'manual' };
    usableLocationRef.current = location;
    setUserLocation(location);
    setPlaceName(place.name); setShowAreaPicker(false);
  };

  const changeProductPage = (page) => {
    if (!userLocation || loading || page < 1 || (page > productPage && !hasMore)) return;
    fetchNearbyData(userLocation.lat, userLocation.lng, searchQuery, radiusKm, availableOnly ? 'available' : 'all', activeCategory, page, userLocation);
  };

  // 3. Open Google Maps
  const saveActivity = (action, shopId, productId) => {
    if (!session?.token || !shopId) return;
    fetch(`${API_BASE_URL}/api/activity/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` }, body: JSON.stringify({ shop_id: shopId, product_id: productId }) }).catch(() => {});
  };

  const handleGetDirections = (lat, lng, name, address, shopId, productId) => {
    saveActivity('directions', shopId, productId);
    const mapsUrl = lat && lng && !isNaN(lat) && !isNaN(lng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name || ''} ${address || ''}`)}`;
    window.open(mapsUrl, '_blank');
  };

  const handleCall = (phone, shopId, productId) => {
    if (!phone) return;
    saveActivity('call', shopId, productId);
    window.open(`tel:${String(phone).replace(/[^+\d]/g, '')}`, '_self');
  };

  const handleWhatsApp = (phone, productName, shopName, shopId, productId) => {
    if (!phone) return;
    const number = String(phone).replace(/\D/g, '');
    if (!number) return;
    saveActivity('whatsapp', shopId, productId);
    const message = productName
      ? `Hi, is ${productName} available at ${shopName || 'your shop'}?`
      : `Hi, I found ${shopName || 'your shop'} on Nearbuy. Is it open now?`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleProductRequest = async (event) => {
    event.preventDefault();
    const requestedProduct = searchQuery.trim();
    if (requestedProduct.length < 2) return;

    setSubmittingRequest(true);
    setRequestMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/product-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_product: requestedProduct,
          customer_phone: requestPhone,
          latitude: userLocation?.lat,
          longitude: userLocation?.lng,
          radius_km: radiusKm ? Number(radiusKm) : null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit request.');
      setRequestMessage('Request received. We will use it to find or onboard nearby shops.');
      setRequestPhone('');
    } catch (error) {
      setRequestMessage(error.message || 'Unable to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  const toggleFavorite = (product) => {
    setFavorites((current) => {
      const exists = current.some((item) => item.id === product.id);
      const next = exists ? current.filter((item) => item.id !== product.id) : [...current, { id: product.id, name: product.name, shop_name: product.shop_name }];
      localStorage.setItem('nearbuy-favorites', JSON.stringify(next));
      return next;
    });
  };

  const shareProduct = async (product) => {
    const text = `${product.name} at ${product.shop_name} — ₹${product.price}`;
    try {
      const url = new URL(productUrl(product), window.location.origin).href;
      if (navigator.share) await navigator.share({ title: product.name, text, url });
      else await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Share error:', error);
    }
  };

  // Helper to compute numeric distance in KM for sorting
  const getItemDistanceKm = (itemLat, itemLng, backendDist) => {
    if (backendDist !== undefined && backendDist !== null && backendDist !== '') {
      const parsed = parseFloat(backendDist);
      if (!isNaN(parsed)) return parsed;
    }
    if (userLocation && itemLat && itemLng) {
      return getDistanceInKm(userLocation.lat, userLocation.lng, itemLat, itemLng);
    }
    return Infinity; // Unknown distance placed at end
  };

  // 4. Products: Filter & Sort by Distance (Nearest First)
  const resultsMatch = resultsKey === discoveryKey(userLocation, searchQuery, radiusKm, availableOnly ? 'available' : 'all', activeCategory);
  const processedProducts = products
    .filter((p) => {
      if (!p || !resultsMatch) return false;
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      return matchCat;
    })
    .map((p) => {
      const distKm = getItemDistanceKm(p.shop_lat, p.shop_lng, p.backendDistance);
      return { ...p, calculatedDistKm: distKm };
    })
    .sort((a, b) => a.calculatedDistKm - b.calculatedDistKm); // Shortest distance first

  // 5. Shops: Filter & Sort by Distance (Nearest First)
  const processedShops = shops
    .filter((s) => {
      if (!s || !resultsMatch) return false;
      const matchCat = activeCategory === 'all' || s.category === activeCategory;
      return matchCat;
    })
    .map((s) => {
      const distKm = getItemDistanceKm(s.lat, s.lng, s.backendDistance);
      return { ...s, calculatedDistKm: distKm };
    })
    .sort((a, b) => a.calculatedDistKm - b.calculatedDistKm); // Shortest distance first

  const shopPageCount = Math.max(1, Math.ceil(processedShops.length / PAGE_SIZE));
  const currentShopPage = Math.min(shopPage, shopPageCount);
  const visibleProducts = processedProducts;
  const visibleShops = processedShops.slice((currentShopPage - 1) * PAGE_SIZE, currentShopPage * PAGE_SIZE);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] px-5 pb-10 font-sans sm:px-8 lg:px-10">
      <section className="nearby-reveal relative mb-6 overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-900/20 sm:px-10 sm:py-12">
        <div className="nearby-hero-orb absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-400/25 blur-3xl" />
        <div className="nearby-hero-orb nearby-hero-orb-delayed absolute -bottom-28 left-1/3 h-52 w-52 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:gap-12">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-200">Nearbuy discovery</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Find it nearby.<br /><span className="text-emerald-300">Buy it today.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Search real products from local shops, check availability, and visit with confidence.</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-200"><span className="rounded-full bg-white/10 px-3 py-1.5">Live availability</span><span className="rounded-full bg-white/10 px-3 py-1.5">Local prices</span><span className="rounded-full bg-white/10 px-3 py-1.5">Direct shop contact</span></div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-3 shadow-xl backdrop-blur-md sm:p-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${userLocation ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-300 text-amber-950'}`}><MapPin className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Your location</p>
                <p title={userLocation ? placeName : locationError || 'Location unavailable'} className="truncate text-sm font-bold text-white">{gettingLocation ? 'Finding location…' : userLocation ? placeName : 'Location unavailable'}</p>
              </div>
              <button type="button" onClick={getUserLocation} disabled={gettingLocation} title="Use current GPS location" aria-label="Use current GPS location" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white hover:text-slate-900 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${gettingLocation ? 'animate-spin' : ''}`} /></button>
            </div>

            {locationError && !userLocation && <p role="alert" className="mt-2 rounded-lg bg-amber-300/10 px-2.5 py-2 text-[11px] leading-4 text-amber-100">{locationError}</p>}

            <button type="button" onClick={() => setShowAreaPicker((value) => !value)} aria-expanded={showAreaPicker} className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-white/10">
              <span className="flex items-center gap-2"><Search className="h-3.5 w-3.5" />Choose area / pincode</span>
              <ChevronRight className={`h-3.5 w-3.5 transition ${showAreaPicker ? 'rotate-90' : ''}`} />
            </button>

            {showAreaPicker && <div className="mt-2">
              <form onSubmit={findArea} className="flex gap-2">
                <input required minLength={2} maxLength={120} value={areaQuery} onChange={(event) => setAreaQuery(event.target.value)} aria-label="Area or pincode in India" placeholder="Area or pincode" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400" />
                <button type="submit" disabled={findingArea || areaQuery.trim().length < 2} className="shrink-0 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-emerald-950 disabled:opacity-50">{findingArea ? 'Finding…' : 'Find'}</button>
              </form>
              {areaError && <p role="alert" className="mt-2 text-xs text-rose-200">{areaError}</p>}
              <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">{areaPlaces.map((place) => <button type="button" key={place.id} onClick={() => chooseArea(place)} className="block w-full rounded-lg bg-white/10 px-3 py-2 text-left text-xs leading-4 text-slate-100 transition hover:bg-emerald-400/20">{place.name}</button>)}</div>
              <p className="mt-2 text-[10px] text-slate-500">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">OpenStreetMap contributors</a></p>
            </div>}
          </div>
        </div>
      </section>

      {/* 2. Scrollable Instagram-style business & service feed */}
      <section className="nearby-reveal nearby-reveal-delay-1 mb-6 overflow-hidden rounded-3xl border border-white bg-white/90 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800"><Layers className="h-4 w-4 text-emerald-600" /> Explore local stores</h3>
            <p className="mt-0.5 text-xs text-slate-500">Businesses, products and everyday services near you</p>
          </div>
          <div className="hidden gap-1 sm:flex">
            <button onClick={() => categoryRailRef.current?.scrollBy({ left: -280, behavior: 'smooth' })} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Previous categories"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => categoryRailRef.current?.scrollBy({ left: 280, behavior: 'smooth' })} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Next categories"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div ref={categoryRailRef} className="flex items-start gap-3 overflow-x-auto scroll-smooth pb-2 pt-1 snap-x scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="group flex w-[76px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl py-1 transition-all duration-300 hover:-translate-y-1 hover:bg-emerald-50/70 focus-visible:bg-emerald-50"
              >
                {/* Story Circle Ring */}
                <div 
                  className={`p-0.5 rounded-full transition-transform transform group-hover:scale-105 ${
                    isActive 
                      ? `bg-gradient-to-tr ${cat.bg} p-[3px] shadow-md` 
                      : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-white text-2xl shadow-inner sm:h-16 sm:w-16 sm:text-3xl">
                    {cat.icon}
                  </div>
                </div>
                
                {/* Category Label */}
                <span className={`line-clamp-2 text-center text-[11px] leading-tight ${isActive ? 'font-bold text-emerald-700' : 'font-semibold text-slate-600'}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 px-1 text-[11px] font-medium text-emerald-700">Showing: {CATEGORIES.find((category) => category.id === activeCategory)?.name || 'All'}</p>
      </section>

      {/* 3. Search Input Field */}
      <div className="nearby-reveal nearby-reveal-delay-2 mb-10 rounded-3xl border border-slate-200/80 bg-white/90 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.07)] backdrop-blur transition-shadow duration-300 hover:shadow-[0_18px_38px_rgba(15,23,42,0.1)]">
        <div className="mb-2 lg:flex lg:items-center lg:gap-2">
        <div className="relative min-w-0 flex-1">
        <Search className="absolute left-4 top-4 h-5 w-5 text-emerald-600" />
        <input
          type="text"
          placeholder="Search products or shops nearby..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
          className="w-full rounded-2xl border border-transparent bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold placeholder:text-slate-400 focus:border-emerald-200 focus:bg-white focus:outline-none"
        />
        {showSuggestions && searchQuery.trim().length >= 2 && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((suggestion) => (
              <button key={`${suggestion.name}-${suggestion.brand || ''}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSearchQuery(suggestion.name); setShowSuggestions(false); }} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-emerald-50">
                <span className="truncate font-semibold text-slate-700">{suggestion.name}{suggestion.brand ? ` · ${suggestion.brand}` : ''}</span>
                <span className="shrink-0 text-xs text-emerald-700">{formatDistanceText(Number(suggestion.distance_km))}</span>
              </button>
            ))}
          </div>
        )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 px-1 pb-1 lg:mt-0 lg:shrink-0 lg:px-0 lg:pb-0">
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${availableOnly ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'}`}>
          <input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} className="sr-only" />
          <span className={`h-2 w-2 rounded-full ${availableOnly ? 'bg-emerald-200' : 'bg-slate-300'}`} />
          Available only
        </label>
      </div>
        </div>
        <DistanceSelector value={radiusKm} onChange={setRadiusKm} />
      </div>

      {resultsMatch && (cachedResults || (loading && products.length > 0)) && <p role="status" className="mb-4 text-sm font-semibold text-emerald-700">{cachedResults ? (loading ? 'Showing saved results. Updating prices and stock…' : 'Showing saved results. Prices and stock may have changed.') : 'Updating products…'}</p>}
      {searchError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        <p>{searchError}{resultsMatch && products.length > 0 ? ' Showing previously loaded results.' : ''}</p>
        <button className="mt-2 font-bold underline" onClick={() => userLocation && fetchNearbyData(userLocation.lat, userLocation.lng, searchQuery, radiusKm, availableOnly ? 'available' : 'all', activeCategory, 1, userLocation)}>Retry search</button>
      </div>}
      {processedProducts.length === 0 && ((!searchError && userLocation && (loading || !resultsMatch)) || gettingLocation) ? (
        <ProductSkeleton />
      ) : !userLocation ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Choose an area or allow GPS to discover nearby products.</div>
      ) : searchError && processedProducts.length === 0 ? null : (
        <div className="space-y-10">
          
          {/* ================= SECTION 1: PRODUCTS NEARBY ================= */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Nearby Products
              </h2>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                {processedProducts.length} items loaded
              </span>
            </div>

            {processedProducts.length === 0 ? (
              <div className="space-y-4">
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">No matching products found nearby.</p>
                </div>
                {searchQuery.trim().length >= 2 && (
                  <form onSubmit={handleProductRequest} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-bold text-emerald-900">Need “{searchQuery.trim()}” nearby?</p>
                    <p className="mt-1 text-xs text-emerald-800">Send a request so we can find or onboard a nearby shop.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input type="tel" value={requestPhone} onChange={(event) => setRequestPhone(event.target.value)} placeholder="Phone number (optional)" className="min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" />
                      <button disabled={submittingRequest} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{submittingRequest ? 'Sending...' : 'Request product'}</button>
                    </div>
                    {requestMessage && <p className="mt-2 text-xs font-medium text-emerald-800">{requestMessage}</p>}
                  </form>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((p, idx) => {
                  const distText = formatDistanceText(p.calculatedDistKm);
                  const availability = availabilityPresentation(p.availability_status);
                  const availabilityUpdatedText = formatUpdatedAt(p.availability_updated_at);

                  return (
                    <div 
                      key={p.id || `product-${idx}`} 
                      className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_18px_38px_rgba(16,185,129,0.13)]"
                    >
                      <div>
                        {/* Image */}
                        <img
                          src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300'}
                          alt={p.name || 'Product'}
                          loading="lazy"
                          decoding="async"
                          className="mb-3 h-44 w-full rounded-2xl object-cover transition duration-500 group-hover:scale-[1.02]"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
                          }}
                        />
                        
                        {/* Name & Price */}
                        <h4 className="font-bold text-slate-800 text-base line-clamp-1">
                          <a href={productUrl(p)} onClick={(event) => event.stopPropagation()}>{p.name || 'Unnamed Product'}</a>
                        </h4>
                        
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-emerald-600 font-bold text-lg">
                            ₹{p.price}
                          </p>
                          {distText && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                              📍 {distText}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${availability.className}`}>
                            {availability.label}
                          </span>
                          {availabilityUpdatedText && <span className="text-[10px] text-slate-400">{availabilityUpdatedText}</span>}
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                          <RatingBadge rating={p.product_average_rating} count={p.product_review_count} label="Product rating" onClick={() => openReviews(p)} />
                          <span className="text-[10px] font-medium text-slate-400">Product reviews</span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.shop_is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700"><BadgeCheck className="h-3 w-3" /> Verified shop</span>}
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${p.shop_is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{p.shop_is_open ? 'Open now' : 'Currently closed'}</span>
                        </div>
                        {p.catalog_updated_at && <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 className="h-3 w-3" /> Catalog {formatUpdatedAt(p.catalog_updated_at)}</p>}

                        {p.brand && <p className="mt-2 text-xs font-semibold text-slate-600 line-clamp-1">{p.brand}</p>}
                        {p.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>}

                        {/* Shop Name */}
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium truncate">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {p.shop_name || 'Local Shop'}
                        </p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button onClick={() => setSelectedProduct(p)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View details</button>
                        <button onClick={() => toggleFavorite(p)} aria-label="Toggle favorite" className={`rounded-lg border px-3 py-2 ${favorites.some((item) => item.id === p.id) ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-300 bg-white text-slate-500'}`}><Heart className={`h-4 w-4 ${favorites.some((item) => item.id === p.id) ? 'fill-current' : ''}`} /></button>
                        <button onClick={() => shareProduct(p)} aria-label="Share product" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-500"><Share2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {p.shop_phone && <button onClick={() => handleCall(p.shop_phone, p.shop_id, p.id)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><Phone className="h-3.5 w-3.5" /> Call</button>}
                        {p.shop_whatsapp_number && <button onClick={() => handleWhatsApp(p.shop_whatsapp_number, p.name, p.shop_name, p.shop_id, p.id)} className="flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>}
                        <button onClick={() => handleGetDirections(p.shop_lat, p.shop_lng, p.shop_name, p.shop_address, p.shop_id, p.id)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"><Navigation className="h-3.5 w-3.5" /> Get Directions</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {processedProducts.length > 0 && <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-medium text-slate-500">Page {productPage} · {PAGE_SIZE} products per page</span>
              <div className="flex gap-2">
                <button onClick={() => changeProductPage(productPage - 1)} disabled={loading || productPage === 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
                <button onClick={() => changeProductPage(productPage + 1)} disabled={loading || !hasMore} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Next <ChevronRight className="h-3.5 w-3.5" /></button>
              </div>
            </div>}
          </section>

          {/* ================= SECTION 2: SHOPS NEARBY ================= */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                Nearby Shops
              </h2>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                {processedShops.length} shops shown
              </span>
            </div>

            {processedShops.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">No nearby shops match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleShops.map((shop, idx) => {
                  const distText = formatDistanceText(shop.calculatedDistKm);

                  return (
                    <div 
                      key={shop.id || `shop-${idx}`} 
                      className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_18px_38px_rgba(16,185,129,0.13)]"
                    >
                      <div>
                        {/* Shop Image */}
                        <ShopImage shop={shop} className="mb-3 h-44 w-full rounded-2xl object-cover transition duration-500 group-hover:scale-[1.02]" />

                        {/* Shop Title */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-800 text-base line-clamp-1">
                            <a href={shopUrl(shop)} onClick={(event) => event.stopPropagation()}>{shop.name}</a>
                          </h4>
                          {distText && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                              📍 {distText}
                            </span>
                          )}
                        </div>

                        {/* Category Badge */}
                        <span className="inline-block mt-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {shop.categoryLabel}
                        </span>
                        <div className="mt-2"><RatingBadge rating={shop.average_rating} count={shop.review_count} label="Shop rating" onClick={() => openReviews({ ...shop, shop_id: shop.id }, 'shop')} /></div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {shop.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700"><BadgeCheck className="h-3 w-3" /> Verified</span>}
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${shop.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{shop.is_open ? 'Open now' : 'Currently closed'}</span>
                        </div>

                        {/* Address */}
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium line-clamp-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {shop.address}
                        </p>
                        {shop.opening_hours && <p className="mt-1 text-xs font-medium text-slate-500">{shop.opening_hours}</p>}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button onClick={() => { saveActivity('view', shop.id); onOpenShop?.(shop); }} className="col-span-2 flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"><Store className="h-3.5 w-3.5" /> View full shop catalog</button>
                        {shop.phone && <button onClick={() => handleCall(shop.phone, shop.id)} className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><Phone className="h-3.5 w-3.5" /> Call</button>}
                        {shop.whatsapp_number && <button onClick={() => handleWhatsApp(shop.whatsapp_number, null, shop.name, shop.id)} className="flex items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</button>}
                        <button onClick={() => handleGetDirections(shop.lat, shop.lng, shop.name, shop.address, shop.id)} className="col-span-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"><Navigation className="h-3.5 w-3.5" /> Get Directions</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Pagination page={currentShopPage} pageCount={shopPageCount} setPage={setShopPage} itemName="shops" />
          </section>

        </div>
      )}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-bold text-slate-800">{selectedProduct.name}</h2><p className="mt-1 text-lg font-extrabold text-emerald-600">₹{selectedProduct.price}</p></div>
              <button onClick={() => setSelectedProduct(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <img src={selectedProduct.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600'} alt={selectedProduct.name} className="mt-4 h-52 w-full rounded-xl object-cover" />
            <div className="mt-4 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-bold ${availabilityPresentation(selectedProduct.availability_status).className}`}>{availabilityPresentation(selectedProduct.availability_status).label}</span><RatingBadge rating={selectedProduct.product_average_rating} count={selectedProduct.product_review_count} label="Product rating" />{selectedProduct.shop_is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-bold text-sky-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified shop</span>}</div>
            {selectedProduct.brand && <p className="mt-4 text-sm font-semibold text-slate-700">{selectedProduct.brand}</p>}
            {selectedProduct.description && <p className="mt-2 text-sm leading-6 text-slate-600">{selectedProduct.description}</p>}
            <form onSubmit={submitReview} className="hidden">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-800">How was your experience?</p><p className="text-xs text-slate-500">Your rating helps nearby customers choose.</p></div><select value={reviewTarget} onChange={(event) => { setReviewTarget(event.target.value); setReviewMessage(''); }} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"><option value="product">Rate product</option><option value="shop">Rate shop</option></select></div>
              <div className="mt-3 flex items-center gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setReviewRating(value)} aria-label={`${value} star rating`} className={`rounded-lg p-1 transition hover:scale-110 ${value <= reviewRating ? 'text-amber-400' : 'text-slate-300'}`}><Star className="h-7 w-7 fill-current" /></button>)}<span className="ml-2 text-sm font-bold text-amber-800">{reviewRating}/5</span></div>
              <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={500} placeholder="Tell others what you liked (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400" />
              <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{reviewMessage}</span><button disabled={savingReview} className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-amber-950 disabled:opacity-60">{savingReview ? 'Saving…' : 'Submit review'}</button></div>
            </form>
            <div className="mt-5 rounded-xl bg-slate-50 p-3"><p className="font-bold text-slate-800">{selectedProduct.shop_name}</p><p className="mt-1 text-sm text-slate-500">{selectedProduct.shop_address}</p></div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {selectedProduct.shop_phone && <button onClick={() => handleCall(selectedProduct.shop_phone, selectedProduct.shop_id, selectedProduct.id)} className="rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700"><Phone className="mr-1 inline h-4 w-4" />Call</button>}
              {selectedProduct.shop_whatsapp_number && <button onClick={() => handleWhatsApp(selectedProduct.shop_whatsapp_number, selectedProduct.name, selectedProduct.shop_name, selectedProduct.shop_id, selectedProduct.id)} className="rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700"><MessageCircle className="mr-1 inline h-4 w-4" />WhatsApp</button>}
              <button onClick={() => handleGetDirections(selectedProduct.shop_lat, selectedProduct.shop_lng, selectedProduct.shop_name, selectedProduct.shop_address, selectedProduct.shop_id, selectedProduct.id)} className="col-span-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white"><Navigation className="mr-1 inline h-4 w-4" />Get Directions</button>
            </div>
          </div>
        </div>
      )}
      {reviewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-amber-600">Community ratings</p><h2 className="mt-1 text-xl font-bold text-slate-800">{reviewTarget === 'shop' ? reviewItem.name : reviewItem.name}</h2><p className="mt-1 text-sm text-slate-500">See what local customers think and share your experience.</p></div>
              <button onClick={() => setReviewItem(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-amber-50 p-3"><Star className="h-7 w-7 fill-amber-400 text-amber-400" /><div><p className="text-lg font-extrabold text-slate-800">{reviewSummary?.average_rating || '0.0'} / 5</p><p className="text-xs text-slate-500">{reviewSummary?.review_count || 0} customer review{Number(reviewSummary?.review_count || 0) === 1 ? '' : 's'}</p></div></div>
            <form onSubmit={submitReview} className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-slate-800">Add your rating</p><select value={reviewTarget} onChange={(event) => { const target = event.target.value; setReviewTarget(target); setReviewMessage(''); loadReviews(target, reviewItem); }} className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"><option value="product" disabled={!reviewItem.shop_id}>Product</option><option value="shop">Shop</option></select></div>
              <div className="mt-3 flex items-center gap-1">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setReviewRating(value)} aria-label={`${value} star rating`} className={`rounded-lg p-1 transition hover:scale-110 ${value <= reviewRating ? 'text-amber-400' : 'text-slate-300'}`}><Star className="h-7 w-7 fill-current" /></button>)}<span className="ml-2 text-sm font-bold text-amber-800">{reviewRating}/5</span></div>
              <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} maxLength={500} placeholder="Tell others what you liked (optional)" className="mt-3 min-h-20 w-full rounded-xl border border-amber-200 bg-white p-3 text-sm outline-none focus:border-amber-400" />
              <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs font-medium text-emerald-700">{reviewMessage}</span><button disabled={savingReview} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-bold text-amber-950 disabled:opacity-60">{savingReview ? 'Saving...' : 'Publish review'}</button></div>
            </form>
            <div className="mt-5"><h3 className="text-sm font-bold text-slate-800">Recent reviews</h3>{existingReviews.length ? <div className="mt-3 space-y-3">{existingReviews.map((review) => <article key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-700">{review.owner_name || 'Nearbuy customer'}</p><span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{review.rating}/5</span></div>{review.comment && <p className="mt-2 text-sm leading-5 text-slate-600">{review.comment}</p>}<p className="mt-2 text-[11px] text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p></article>)}</div> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No reviews yet. Be the first to share your experience.</p>}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbySearch;
