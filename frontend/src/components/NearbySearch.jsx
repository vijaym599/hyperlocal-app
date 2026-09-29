import React, { useState, useEffect } from 'react';
import { Search, MapPin, Store, Package, Navigation, RefreshCw, Layers } from 'lucide-react';

// Instagram Story Style Categories Data
const CATEGORIES = [
  { id: 'all', name: 'All', icon: '🛍️', bg: 'from-amber-400 to-pink-500' },
  { id: 'grocery', name: 'Grocery', icon: '🛒', bg: 'from-green-400 to-emerald-600' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥬', bg: 'from-lime-400 to-green-600' },
  { id: 'fashion', name: 'Fashion', icon: '👕', bg: 'from-purple-400 to-indigo-600' },
  { id: 'electronics', name: 'Electronics', icon: '📱', bg: 'from-blue-400 to-cyan-600' },
  { id: 'pharmacy', name: 'Pharmacy', icon: '💊', bg: 'from-red-400 to-rose-600' },
  { id: 'bakery', name: 'Bakery', icon: '🎂', bg: 'from-orange-400 to-amber-600' },
];

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

const NearbySearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  useEffect(() => {
    getUserLocation();
  }, []);

  // 1. Get Live Location
  const getUserLocation = () => {
    setGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Ungal Browser Location sevaiyai aadharikkavillai.');
      setGettingLocation(false);
      fetchNearbyData(null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setGettingLocation(false);
        fetchNearbyData(latitude, longitude);
      },
      (error) => {
        console.error("Location Error:", error);
        setLocationError('Iruppidathai pera mudiyavillai. GPS On seyyappattulladha ena paarkkavum.');
        setGettingLocation(false);
        fetchNearbyData(null, null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 2. Fetch Shops & Products
  const fetchNearbyData = async (lat, lng) => {
    setLoading(true);
    try {
      let url = 'http://localhost:5000/api/shops/nearby-products';
      if (lat && lng) {
        url += `?lat=${lat}&lng=${lng}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();

        let rawShops = [];
        if (data.shops && Array.isArray(data.shops)) {
          rawShops = data.shops;
        }

        // Extract Shops
        const formattedShops = rawShops.map((shop, index) => {
          const latVal = parseFloat(shop.latitude || shop.lat);
          const lngVal = parseFloat(shop.longitude || shop.lng);
          return {
            id: shop.id || shop.shop_id || `shop-${index}`,
            name: shop.name || shop.shop_name || 'Local Shop',
            address: shop.address || shop.location_name || 'Nearby',
            category: (shop.category || 'grocery').toLowerCase(),
            lat: isNaN(latVal) ? null : latVal,
            lng: isNaN(lngVal) ? null : lngVal,
            backendDistance: shop.distance,
            image_url: shop.image_url || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=300',
            total_products: shop.products ? shop.products.length : 0
          };
        });

        // Extract Products
        const extractedProducts = rawShops.flatMap((shop, sIdx) => 
          (shop.products || []).map((prod, pIdx) => {
            const pLat = parseFloat(shop.latitude || shop.lat || prod.latitude);
            const pLng = parseFloat(shop.longitude || shop.lng || prod.longitude);
            return {
              ...prod,
              id: prod.id || `prod-${sIdx}-${pIdx}`,
              shop_name: shop.name || shop.shop_name,
              shop_id: shop.id || shop.shop_id,
              shop_lat: isNaN(pLat) ? null : pLat,
              shop_lng: isNaN(pLng) ? null : pLng,
              shop_address: shop.address || shop.location_name,
              category: (prod.category || shop.category || 'grocery').toLowerCase(),
              backendDistance: shop.distance || prod.distance
            };
          })
        );

        setShops(formattedShops);
        setProducts(extractedProducts);
      }
    } catch (err) {
      console.error("Error fetching nearby data:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Open Google Maps
  const handleGetDirections = (lat, lng, name, address) => {
    let mapsUrl = '';
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    } else {
      const query = encodeURIComponent(`${name || ''} ${address || ''}`);
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    window.open(mapsUrl, '_blank');
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
  const processedProducts = products
    .filter((p) => {
      if (!p) return false;
      const matchCat = activeCategory === 'all' || p.category === activeCategory;
      const term = searchQuery.toLowerCase();
      const matchSearch = (p.name || '').toLowerCase().includes(term) || (p.shop_name || '').toLowerCase().includes(term);
      return matchCat && matchSearch;
    })
    .map((p) => {
      const distKm = getItemDistanceKm(p.shop_lat, p.shop_lng, p.backendDistance);
      return { ...p, calculatedDistKm: distKm };
    })
    .sort((a, b) => a.calculatedDistKm - b.calculatedDistKm); // Shortest distance first

  // 5. Shops: Filter & Sort by Distance (Nearest First)
  const processedShops = shops
    .filter((s) => {
      if (!s) return false;
      const matchCat = activeCategory === 'all' || s.category === activeCategory;
      const term = searchQuery.toLowerCase();
      const matchSearch = (s.name || '').toLowerCase().includes(term) || (s.address || '').toLowerCase().includes(term);
      return matchCat && matchSearch;
    })
    .map((s) => {
      const distKm = getItemDistanceKm(s.lat, s.lng, s.backendDistance);
      return { ...s, calculatedDistKm: distKm };
    })
    .sort((a, b) => a.calculatedDistKm - b.calculatedDistKm); // Shortest distance first

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans bg-slate-50 min-h-screen">
      
      {/* 1. GPS Location Status Bar */}
      <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs sm:text-sm shadow-sm">
        <div className="flex items-center gap-2 text-emerald-800 truncate pr-2">
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          {gettingLocation ? (
            <span>Iruppidathai kandarigiradhu...</span>
          ) : userLocation ? (
            <span className="truncate">
              <strong>Live Location:</strong> {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
            </span>
          ) : (
            <span className="text-amber-700 truncate">{locationError || 'Iruppidam kidaikkavillai.'}</span>
          )}
        </div>

        <button
          onClick={getUserLocation}
          disabled={gettingLocation}
          className="flex items-center gap-1 text-emerald-700 font-semibold hover:underline bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shadow-sm shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${gettingLocation ? 'animate-spin' : ''}`} />
          {gettingLocation ? 'Locating...' : 'Refresh'}
        </button>
      </div>

      {/* 2. Instagram Story Style Categories Bar */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 px-1 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-slate-400" /> Categories
        </h3>
        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none snap-x">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group snap-start"
              >
                {/* Story Circle Ring */}
                <div 
                  className={`p-0.5 rounded-full transition-transform transform group-hover:scale-105 ${
                    isActive 
                      ? `bg-gradient-to-tr ${cat.bg} p-[3px] shadow-md` 
                      : 'bg-slate-200 hover:bg-slate-300'
                  }`}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white flex items-center justify-center text-2xl sm:text-3xl border-2 border-white shadow-inner">
                    {cat.icon}
                  </div>
                </div>
                
                {/* Category Label */}
                <span className={`text-xs font-semibold ${isActive ? 'text-emerald-700 font-bold' : 'text-slate-600'}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Search Input Field */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search products or shops nearby..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 shadow-sm"
        />
      </div>

      {/* 4. Loading State */}
      {loading ? (
        <div className="text-center py-16">
          <p className="text-sm font-medium text-slate-500 animate-pulse">Thagavalgal segarikkappadugindrana...</p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* ================= SECTION 1: PRODUCTS NEARBY ================= */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Nearby Products
              </h2>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                {processedProducts.length} items
              </span>
            </div>

            {processedProducts.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">Porutkal edhum kidaikkavillai.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {processedProducts.map((p, idx) => {
                  const distText = formatDistanceText(p.calculatedDistKm);

                  return (
                    <div 
                      key={p.id || `product-${idx}`} 
                      className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        {/* Image */}
                        <img
                          src={p.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300'}
                          alt={p.name || 'Product'}
                          className="w-full h-36 object-cover rounded-lg mb-3"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
                          }}
                        />
                        
                        {/* Name & Price */}
                        <h4 className="font-bold text-slate-800 text-base line-clamp-1">
                          {p.name || 'Unnamed Product'}
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

                        {/* Shop Name */}
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium truncate">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {p.shop_name || 'Local Shop'}
                        </p>
                      </div>

                      {/* Direction Button */}
                      <button
                        onClick={() => handleGetDirections(p.shop_lat, p.shop_lng, p.shop_name, p.shop_address)}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-3 rounded-lg transition-colors cursor-pointer shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Get Directions
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ================= SECTION 2: SHOPS NEARBY ================= */}
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Store className="w-5 h-5 text-emerald-600" />
                Nearby Shops
              </h2>
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">
                {processedShops.length} shops
              </span>
            </div>

            {processedShops.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <Store className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 font-medium">Kadaigal edhum kidaikkavillai.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {processedShops.map((shop, idx) => {
                  const distText = formatDistanceText(shop.calculatedDistKm);

                  return (
                    <div 
                      key={shop.id || `shop-${idx}`} 
                      className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        {/* Shop Image */}
                        <img
                          src={shop.image_url}
                          alt={shop.name || 'Shop'}
                          className="w-full h-36 object-cover rounded-lg mb-3"
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=300';
                          }}
                        />

                        {/* Shop Title */}
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-800 text-base line-clamp-1">
                            {shop.name}
                          </h4>
                          {distText && (
                            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold shrink-0">
                              📍 {distText}
                            </span>
                          )}
                        </div>

                        {/* Category Badge */}
                        <span className="inline-block mt-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          {shop.category}
                        </span>

                        {/* Address */}
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 font-medium line-clamp-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {shop.address}
                        </p>
                      </div>

                      {/* Direction Button */}
                      <button
                        onClick={() => handleGetDirections(shop.lat, shop.lng, shop.name, shop.address)}
                        className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-2.5 px-3 rounded-lg transition-colors cursor-pointer shadow-sm"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Get Directions
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
};

export default NearbySearch;