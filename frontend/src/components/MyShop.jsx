import { useState, useEffect } from 'react';
import { Store, Package, Plus, UserPlus, LogIn, ArrowLeft, BadgeCheck, BarChart3, CalendarDays, Eye, EyeOff, Loader2, MessageCircle, Navigation, PhoneCall, Search, Star, Upload, RefreshCw, LogOut, Pencil, X, Tag, Trash2 } from 'lucide-react';
import { parseProductCsv } from '../csv.mjs';
import { API_BASE_URL } from '../config';

const SUBSCRIPTION_PLANS = [
  { id: 'basic', name: 'Basic', price: 20, limit: 10, desc: 'Great for growing neighborhood stores · no shop insights' },
  { id: 'pro', name: 'Pro', price: 199, limit: 100, desc: 'Monthly and total shop insights included' },
  { id: 'advance', name: 'Advance', price: 499, limit: 300, desc: 'Monthly and total shop insights included' },
  { id: 'enterprise', name: 'Enterprise', price: 999, limit: 999999, desc: 'Unlimited products, priority support & insights' }
];

// SHOP CATEGORIES LIST
const SHOP_CATEGORIES = [
  'Grocery & Supermarket',
  'Clothing & Fashion',
  'Electronics & Mobiles',
  'Bakery & Restaurant',
  'Pharmacy & Healthcare',
  'Hardware & Electricals',
  'Beauty & Cosmetics',
  'Vegetables & Fruits',
  'General Store',
  'Food & Dining',
  'Home & Furniture',
  'Stationery & Books',
  'Jewellery & Accessories',
  'Automotive & Vehicle Care',
  'Pet Supplies & Services',
  'Education & Tuition',
  'Fitness & Sports',
  'Local & Professional Services',
  'Others'
];

const productFallbackImage = (product) => `https://loremflickr.com/640/480/${encodeURIComponent(`${product.brand || ''} ${product.name || 'local product'}`.trim())}`;
const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' }
];
const INSIGHT_PLANS = new Set(['pro', 'advance', 'enterprise']);

const availabilityBadgeClass = (status) => ({
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-rose-50 text-rose-700 border-rose-200'
}[status] || 'bg-slate-50 text-slate-600 border-slate-200');

const availabilityLabel = (status) => AVAILABILITY_OPTIONS.find((item) => item.value === status)?.label || 'Available';

const MAX_PRODUCT_IMAGE_DIMENSION = 1200;
const MAX_PRODUCT_IMAGE_SIZE = 1.2 * 1024 * 1024;

const optimiseProductImage = (file) => new Promise((resolve, reject) => {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    reject(new Error('Please upload a JPG, PNG, or WebP image.'));
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    reject(new Error('Please choose an image smaller than 12 MB.'));
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(1, MAX_PRODUCT_IMAGE_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);

    const exportImage = (quality) => canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Unable to optimize this image. Please try another file.'));
      if (blob.size > MAX_PRODUCT_IMAGE_SIZE && quality > 0.6) return exportImage(0.65);
      if (blob.size > MAX_PRODUCT_IMAGE_SIZE) return reject(new Error('This image is still too large after optimization. Please choose a smaller image.'));
      const reader = new FileReader();
      reader.onloadend = () => resolve({ dataUrl: reader.result, sizeKb: Math.ceil(blob.size / 1024) });
      reader.readAsDataURL(blob);
    }, 'image/webp', quality);
    exportImage(0.82);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('This image could not be read. Please try another file.'));
  };
  image.src = objectUrl;
});

const fetchShopOffers = async (shopId, token) => {
  const response = await fetch(`${API_BASE_URL}/api/shops/${shopId}/offers`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load offers.');
  return data.offers || [];
};

const MyShop = ({ session, onLoginSuccess, onLogout }) => {
  const [viewMode, setViewMode] = useState(session?.token ? 'dashboard' : 'choice');
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState(null);

  const [loginData, setLoginData] = useState({ phone: '', password: '' });
  const [shopData, setShopData] = useState(session?.shop || null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [updatingStockId, setUpdatingStockId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [insights, setInsights] = useState(null);
  const [insightsPeriod, setInsightsPeriod] = useState('total');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState('');
  const [shopOffers, setShopOffers] = useState([]);
  const [offerForm, setOfferForm] = useState({ title: '', discount_text: '', description: '', valid_until: '' });
  const [editingOffer, setEditingOffer] = useState(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [offersLoading, setOffersLoading] = useState(false);

  // REGISTRATION FORM WITH CATEGORY
  const [regForm, setRegForm] = useState({
    owner_name: '',
    account_phone: '',
    email: '',
    password: '',
    shop_name: '',
    category: '', // Added Category
    address: '',
    phone: '',
    whatsapp_number: '',
    opening_hours: '',
    opening_time: '',
    closing_time: '',
    google_map_link: '',
    latitude: '',
    longitude: '',
    selected_plan: 'basic'
  });

  const [newProduct, setNewProduct] = useState({ name: '', brand: '', description: '', price: '', image_url: '', availability_status: 'available' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingShop, setEditingShop] = useState(false);
  const [dashboardSection, setDashboardSection] = useState('catalog');
  const [bulkMessage, setBulkMessage] = useState('');
  const [shopForm, setShopForm] = useState({ name: '', category: '', address: '', phone: '', whatsapp_number: '', opening_hours: '', opening_time: '', closing_time: '', latitude: '', longitude: '', google_map_link: '' });
  const [autoOpen, setAutoOpen] = useState(shopData?.is_open !== false);

  const activePlanDetails = SUBSCRIPTION_PLANS.find(p => p.id === (shopData?.subscription_plan || 'free')) || SUBSCRIPTION_PLANS[0];
  const maxProductsAllowed = activePlanDetails.limit;
  const hasShopInsights = INSIGHT_PLANS.has(shopData?.subscription_plan);
  const currentDate = new Date();
  const todayIso = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const filteredProducts = products.filter((product) => [product.name, product.brand, product.description].some((value) => String(value || '').toLowerCase().includes(productSearch.trim().toLowerCase())));
  const authenticatedJsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  });

  useEffect(() => {
    if (!shopData?.id) return undefined;
    const controller = new AbortController();
    const sync = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/portfolio`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        setAutoOpen(data.shop.is_open !== false);
      } catch (error) {
        if (error.name !== 'AbortError') console.error('Shop status refresh failed:', error);
      }
    };
    void sync();
    const timer = window.setInterval(sync, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [shopData?.id, shopData?.opening_time, shopData?.closing_time]);

  useEffect(() => {
    if (!shopData?.id || !session?.token || !INSIGHT_PLANS.has(shopData.subscription_plan)) return;
    const loadInsights = async () => {
      setInsightsLoading(true);
      setInsightsError('');
      try {
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/insights?period=${insightsPeriod}`, { headers: { Authorization: `Bearer ${session.token}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load shop insights.');
        setInsights(data.insights || null);
      } catch (error) {
        setInsightsError(error.message);
      } finally {
        setInsightsLoading(false);
      }
    };
    void loadInsights();
  }, [shopData?.id, shopData?.subscription_plan, session?.token, insightsPeriod]);

  const updateSubscription = async (action, plan = null) => {
    if (!shopData?.id) return;
    if (action === 'cancel' && !window.confirm('Cancel automatic renewal? Your current plan stays active until its billing period ends.')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/subscription`, { method: 'PATCH', headers: authenticatedJsonHeaders(), body: JSON.stringify({ action, plan, payment_id: action === 'cancel' ? undefined : `MOCK_PAY_${Date.now()}` }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update subscription.');
      setShopData(data.shop);
      const updatedSession = { ...session, shop: data.shop };
      localStorage.setItem('hyperlocal-session', JSON.stringify(updatedSession)); onLoginSuccess?.(updatedSession);
    } catch (error) { alert(error.message); } finally { setLoading(false); }
  };

  const fetchProductsFromBackend = async (shopId) => {
    if (!shopId) return;
    setFetchingProducts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shops/${shopId}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        console.error("Failed to fetch products. Server Status:", res.status);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setFetchingProducts(false);
    }
  };

  useEffect(() => {
    if (shopData?.id) {
      void Promise.resolve().then(() => fetchProductsFromBackend(shopData.id));
    }
  }, [shopData?.id]);

  const loadShopOffers = async () => {
    if (!shopData?.id || !session?.token) return;
    setShopOffers(await fetchShopOffers(shopData.id, session.token));
  };

  useEffect(() => {
    if (!shopData?.id || !session?.token) return;
    void Promise.resolve().then(async () => {
      try { setShopOffers(await fetchShopOffers(shopData.id, session.token)); }
      catch (error) { setOfferMessage(error.message); }
    });
  }, [shopData, session]);

  const handleImageFileUpload = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploadMessage('Optimizing image for faster loading…');
    try {
      const { dataUrl, sizeKb } = await optimiseProductImage(file);
      if (isEdit) setEditingProduct(prev => ({ ...prev, image_url: dataUrl }));
      else setNewProduct(prev => ({ ...prev, image_url: dataUrl }));
      setImageUploadMessage(`Optimized to ${sizeKb} KB and ready to upload.`);
    } catch (error) {
      setImageUploadMessage(error.message);
    } finally {
      e.target.value = '';
    }
  };

  const handleBulkFile = (event) => {
    const file = event.target.files?.[0];
    if (!file || !shopData?.id) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const productsToUpload = parseProductCsv(reader.result);
        if (!productsToUpload.length) throw new Error('No products found in this CSV.');
        setLoading(true); setBulkMessage('Uploading products…');
        const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/products/bulk`, { method: 'POST', headers: authenticatedJsonHeaders(), body: JSON.stringify({ products: productsToUpload }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Bulk upload failed.');
        setBulkMessage(data.message); await fetchProductsFromBackend(shopData.id);
      } catch (error) { setBulkMessage(error.message); } finally { setLoading(false); event.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser does not support Geolocation.");
      return;
    }
    setFetchingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRegForm(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }));
        setFetchingLoc(false);
      },
      (err) => {
        setFetchingLoc(false);
        alert("Unable to fetch location: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error(`Server error (${res.status}). Please check backend terminal.`);
      }

      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess({ token: data.token, user: data.user, shop: data.shop });
      }
      setShopData(data.shop);
      setViewMode('dashboard');
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (planId, paymentId = null) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const payload = { 
        ...regForm, 
        selected_plan: planId,
        payment_id: paymentId 
      };

      const res = await fetch(`${API_BASE_URL}/api/auth/register-shop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error(`Server returned status ${res.status}. Check backend logs.`);
      }

      if (!res.ok) throw new Error(data.error || 'Shop creation failed');

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess({ token: data.token, user: data.user, shop: data.shop });
      }

      setShopData(data.shop);
      setViewMode('dashboard');

    } catch (err) {
      console.error("Register Error:", err);
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    if (!shopData || !shopData.id) {
      alert("Shop session error! Please Sign Out and Sign In again.");
      return;
    }

    if (products.length >= maxProductsAllowed) {
      alert(`Product limit reached! Your current plan allows maximum ${maxProductsAllowed} products.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/products`, {
        method: 'POST',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify(newProduct)
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error(`Server returned non-JSON response: ${res.status}`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to add product');

      await fetchProductsFromBackend(shopData.id);
      setNewProduct({ name: '', brand: '', description: '', price: '', image_url: '', availability_status: 'available' });
      alert("Product added successfully!");

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct || !shopData?.id) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify({
          name: editingProduct.name,
          brand: editingProduct.brand,
          description: editingProduct.description,
          price: editingProduct.price,
          image_url: editingProduct.image_url,
          availability_status: editingProduct.availability_status,
          shop_id: shopData.id
        })
      });

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        throw new Error(`Server returned non-JSON response: ${res.status}`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to update product');

      alert("Product updated successfully!");
      setEditingProduct(null);
      await fetchProductsFromBackend(shopData.id);

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStockUpdate = async (product, availability_status) => {
    if (product.availability_status === availability_status) return;
    setUpdatingStockId(product.id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${product.id}/availability`, {
        method: 'PATCH',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify({ availability_status })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update stock status.');
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, ...data.product } : item));
    } catch (error) {
      alert(error.message);
    } finally {
      setUpdatingStockId(null);
    }
  };

  const handleCreateOffer = async (event) => {
    event.preventDefault();
    if (!shopData?.id) return;
    if (offerForm.valid_until && offerForm.valid_until < todayIso) {
      setOfferMessage('Choose today or a future offer expiry date.');
      return;
    }
    setOffersLoading(true);
    setOfferMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/offers`, { method: 'POST', headers: authenticatedJsonHeaders(), body: JSON.stringify(offerForm) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to publish offer.');
      setOfferForm({ title: '', discount_text: '', description: '', valid_until: '' });
      setOfferMessage('Offer published. Customers can now see it in Offers.');
      await loadShopOffers();
    } catch (error) { setOfferMessage(error.message); } finally { setOffersLoading(false); }
  };

  const handleUpdateOffer = async (event) => {
    event.preventDefault();
    if (!editingOffer) return;
    if (editingOffer.valid_until && editingOffer.valid_until < todayIso) {
      setOfferMessage('Choose today or a future offer expiry date.');
      return;
    }
    setOffersLoading(true);
    setOfferMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${editingOffer.id}`, {
        method: 'PATCH',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify({
          title: editingOffer.title,
          discount_text: editingOffer.discount_text,
          description: editingOffer.description,
          valid_until: editingOffer.valid_until || ''
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update offer.');
      setEditingOffer(null);
      setOfferMessage('Offer updated.');
      setShopOffers((current) => current.map((offer) => offer.id === data.offer.id ? data.offer : offer));
      void loadShopOffers().catch((error) => setOfferMessage(error.message));
    } catch (error) { setOfferMessage(error.message); } finally { setOffersLoading(false); }
  };

  const updateOfferStatus = async (offer, is_active) => {
    setOffersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${offer.id}`, { method: 'PATCH', headers: authenticatedJsonHeaders(), body: JSON.stringify({ is_active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update offer.');
      await loadShopOffers();
    } catch (error) { setOfferMessage(error.message); } finally { setOffersLoading(false); }
  };

  const deleteOffer = async (offer) => {
    if (!window.confirm(`Remove “${offer.title}”?`)) return;
    setOffersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${offer.id}`, { method: 'DELETE', headers: authenticatedJsonHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to remove offer.');
      await loadShopOffers();
    } catch (error) { setOfferMessage(error.message); } finally { setOffersLoading(false); }
  };

  const handleDeleteProduct = async (product) => {
    if (!shopData?.id || !window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
        method: 'DELETE',
        headers: authenticatedJsonHeaders()
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete product.');
      await fetchProductsFromBackend(shopData.id);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openShopEditor = () => {
    setShopForm({
      name: shopData?.name || shopData?.shop_name || '',
      category: shopData?.category || '',
      address: shopData?.address || '',
      phone: shopData?.phone || '',
      whatsapp_number: shopData?.whatsapp_number || '',
      opening_hours: shopData?.opening_hours || '',
      opening_time: shopData?.opening_time ? String(shopData.opening_time).slice(0, 5) : '',
      closing_time: shopData?.closing_time ? String(shopData.closing_time).slice(0, 5) : '',
      latitude: shopData?.latitude ?? '',
      longitude: shopData?.longitude ?? '',
      google_map_link: shopData?.google_map_link || ''
    });
    setEditingShop(true);
  };

  const handleUpdateShop = async (e) => {
    e.preventDefault();
    if (!shopData?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}`, {
        method: 'PUT',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify(shopForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update shop details');
      setShopData(data.shop);
      const updatedSession = { ...session, shop: data.shop };
      localStorage.setItem('hyperlocal-session', JSON.stringify(updatedSession));
      onLoginSuccess?.(updatedSession);
      setEditingShop(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session?.token && viewMode === 'choice') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-2xl border border-slate-200 text-center shadow-sm font-sans">
        <Store className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">My Shop Portal</h3>
        <p className="text-sm text-slate-500 mb-6">Manage your local business & list products.</p>
        <div className="space-y-3">
          <button onClick={() => { setErrorMsg(''); setViewMode('login'); }} className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition flex items-center justify-center gap-2 cursor-pointer text-sm">
            <LogIn className="w-4 h-4" /> Already Registered? Sign In
          </button>
          <button onClick={() => { setErrorMsg(''); setViewMode('register_wizard'); setWizardStep(1); }} className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer text-sm">
            <UserPlus className="w-4 h-4" /> Create New Shop
          </button>
        </div>
      </div>
    );
  }

  if (!session?.token && viewMode === 'login') {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm font-sans">
        <button onClick={() => setViewMode('choice')} className="text-xs text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Sign In to My Shop</h2>
        {errorMsg && <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">{errorMsg}</div>}
        {resetNotice && <div className="p-3 mb-4 bg-sky-50 border border-sky-200 text-sky-700 text-xs rounded-xl">{resetNotice}</div>}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Phone number</label>
            <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="+919876543210" value={loginData.phone} onChange={(e) => setLoginData({ ...loginData, phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <div className="relative"><input type={showLoginPassword ? 'text' : 'password'} autoComplete="current-password" required placeholder="Password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-xl text-sm" /><button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} aria-label={showLoginPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">{showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          </div>
          <button type="button" onClick={() => setResetNotice('Password reset through phone OTP will be available soon. Until then, please contact support to recover your account.')} className="-mt-1 text-left text-xs font-semibold text-emerald-700 hover:underline">Forgot password?</button>
          <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 transition cursor-pointer flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : 'Sign In'}
          </button>
        </form>
      </div>
    );
  }

  if (!session?.token && viewMode === 'register_wizard') {
    return (
      <div className="max-w-2xl mx-auto my-8 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm font-sans">
        {wizardStep === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setErrorMsg(''); setWizardStep(2); }} className="space-y-4">
            <button type="button" onClick={() => setViewMode('choice')} className="text-xs text-slate-500 hover:text-slate-800 mb-2 flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Owner & Shop Information</h2>
            
            {errorMsg && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">{errorMsg}</div>}

            <input type="text" required placeholder="Owner Name *" value={regForm.owner_name} onChange={(e) => setRegForm({ ...regForm, owner_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="Account phone with country code, e.g. +919876543210 *" value={regForm.account_phone} onChange={(e) => setRegForm({ ...regForm, account_phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="email" autoComplete="email" placeholder="Email (optional)" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <div className="relative"><input type={showRegisterPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} placeholder="Password (minimum 8 characters) *" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-xl text-sm" /><button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)} aria-label={showRegisterPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800">{showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
            
            <input type="text" required placeholder="Shop Name *" value={regForm.shop_name} onChange={(e) => setRegForm({ ...regForm, shop_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            
            {/* SHOP CATEGORY SELECT DROPDOWN */}
            <select
              required
              value={regForm.category}
              onChange={(e) => setRegForm({ ...regForm, category: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              <option value="" disabled>Select Shop Category *</option>
              {SHOP_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <textarea required rows="2" placeholder="Shop address *" value={regForm.address} onChange={(e) => setRegForm({ ...regForm, address: e.target.value })} className="w-full resize-none px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="tel" required placeholder="Call number with country code, e.g. +919876543210 *" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="tel" placeholder="WhatsApp number (optional)" value={regForm.whatsapp_number} onChange={(e) => setRegForm({ ...regForm, whatsapp_number: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="text" placeholder="Opening hours, e.g. 9 AM – 9 PM" value={regForm.opening_hours} onChange={(e) => setRegForm({ ...regForm, opening_hours: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Open time<input type="time" value={regForm.opening_time} onChange={(e) => setRegForm({ ...regForm, opening_time: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Close time<input type="time" value={regForm.closing_time} onChange={(e) => setRegForm({ ...regForm, closing_time: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label></div>
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Location</span>
                <button type="button" onClick={handleGetCurrentLocation} disabled={fetchingLoc} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-emerald-700">
                  {fetchingLoc ? 'Detecting...' : 'Use My Current Location'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" step="any" required placeholder="Latitude *" value={regForm.latitude} onChange={(e) => setRegForm({ ...regForm, latitude: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white" />
                <input type="number" step="any" required placeholder="Longitude *" value={regForm.longitude} onChange={(e) => setRegForm({ ...regForm, longitude: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white" />
              </div>
            </div>
            
            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 transition cursor-pointer">
              Next Step (Choose Subscription)
            </button>
          </form>
        )}

        {wizardStep === 2 && (
          <div>
            <button type="button" onClick={() => { setWizardStep(1); setErrorMsg(''); }} className="text-xs text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="w-3 h-3" /> Back to Shop Details
            </button>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Choose Subscription</h2>
            <p className="text-xs text-slate-500 mb-4">Select a plan to complete your shop registration.</p>

            {errorMsg && (
              <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div key={plan.id} className="border border-slate-200 p-4 rounded-xl bg-white flex flex-col justify-between shadow-xs hover:border-emerald-500 transition">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{plan.id}</span>
                    <h4 className="font-bold text-slate-800 text-lg">{plan.name}</h4>
                    <p className="text-2xl font-extrabold text-slate-900 my-2">₹{plan.price}</p>
                    <p className="text-xs text-slate-500 mb-3">{plan.desc}</p>
                    <p className="text-xs text-slate-600 font-medium bg-slate-50 p-2 rounded-lg mb-4">
                      Limit: <strong>{plan.limit >= 9999 ? 'Unlimited' : plan.limit} products</strong>
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedSubscriptionPlan(plan)}
                    disabled={loading} 
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    {selectedSubscriptionPlan?.id === plan.id ? 'Selected' : `Choose ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
            {selectedSubscriptionPlan && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-bold text-slate-800">Selected: {selectedSubscriptionPlan.name} — ₹{selectedSubscriptionPlan.price}/month</p><p className="mt-1 text-xs text-slate-600">Confirm to create your shop with this subscription. You can upgrade, switch, or cancel renewal later from Billing.</p><button type="button" disabled={loading} onClick={() => handleRegisterSubmit(selectedSubscriptionPlan.id, `MOCK_PAY_${Date.now()}`)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Creating shop…</> : `Confirm ${selectedSubscriptionPlan.name} & create shop`}</button><p className="mt-2 text-center text-[11px] text-slate-500">Demo payment confirmation — connect a real gateway before live payments.</p></div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 font-sans">
      {/* Dashboard Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 mb-6 flex justify-between items-center shadow-md">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-emerald-400 mb-1">
            <Store className="w-3.5 h-3.5" />
            <span>Shop Dashboard</span>
            {shopData?.category && (
              <>
                <span className="text-slate-600">•</span>
                <span className="bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-md flex items-center gap-1 text-[11px] font-normal lowercase tracking-normal">
                  <Tag className="w-3 h-3" /> {shopData.category}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{shopData?.name || 'My Shop'}</h1>{shopData?.is_verified && <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/15 px-2 py-1 text-[11px] font-bold text-sky-200"><BadgeCheck className="h-3.5 w-3.5" />Verified shop</span>}</div>
          <p className="text-xs text-slate-400 mt-1">
            Plan: <span className="text-emerald-400 font-bold uppercase">{shopData?.subscription_plan || 'Free'}</span> ({products.length} / {maxProductsAllowed >= 9999 ? '∞' : maxProductsAllowed} Products)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-xl px-3 py-2 text-xs font-bold ${autoOpen ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>{autoOpen ? 'Auto: Open now' : 'Auto: Closed'}</span>
          <button onClick={openShopEditor} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-1 text-xs cursor-pointer" title="Edit shop details">
            <Pencil className="w-4 h-4" /><span className="hidden sm:inline">Edit Shop</span>
          </button>
          <button onClick={() => setDashboardSection('billing')} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition text-xs font-semibold">Billing</button>
          <button 
            onClick={() => fetchProductsFromBackend(shopData?.id)} 
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition flex items-center gap-1 text-xs cursor-pointer"
            title="Refresh Products"
          >
            <RefreshCw className={`w-4 h-4 ${fetchingProducts ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {typeof onLogout === 'function' && (
            <button 
              onClick={onLogout} 
              className="p-2 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-xl transition flex items-center gap-1 text-xs cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><button type="button" onClick={() => setDashboardSection('catalog')} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${dashboardSection === 'catalog' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Products & stock</button><button type="button" onClick={() => setDashboardSection('offers')} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${dashboardSection === 'offers' ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Offers</button>{hasShopInsights && <button type="button" onClick={() => setDashboardSection('insights')} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${dashboardSection === 'insights' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Customer activity</button>}<button type="button" onClick={() => setDashboardSection('billing')} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${dashboardSection === 'billing' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Billing</button></div>

      {dashboardSection === 'billing' && <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-slate-800">Subscription & billing</h2><p className="mt-1 text-sm text-slate-600">Current plan: <strong className="uppercase">{shopData?.subscription_plan}</strong> · {shopData?.subscription_status === 'cancelled' ? 'Renewal cancelled' : 'Active'}</p></div>{shopData?.subscription_status === 'cancelled' ? <button disabled={loading} onClick={() => updateSubscription('resume', shopData.subscription_plan)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">Resume plan</button> : <button disabled={loading} onClick={() => updateSubscription('cancel')} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700">Cancel renewal</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{SUBSCRIPTION_PLANS.map((plan) => <div key={plan.id} className={`rounded-xl border p-3 ${shopData?.subscription_plan === plan.id ? 'border-emerald-500 bg-white' : 'border-emerald-100 bg-white/60'}`}><p className="font-bold text-slate-800">{plan.name} · ₹{plan.price}/mo</p><p className="mt-1 text-xs text-slate-500">{plan.limit >= 9999 ? 'Unlimited' : plan.limit} products · {plan.desc}</p><button disabled={loading || shopData?.subscription_plan === plan.id} onClick={() => updateSubscription('change', plan.id)} className="mt-3 text-xs font-bold text-emerald-700 disabled:text-slate-400">{shopData?.subscription_plan === plan.id ? 'Current plan' : 'Upgrade / switch'}</button></div>)}</div><p className="mt-3 text-[11px] text-slate-500">Demo billing flow: a real payment gateway must be connected before processing live payments.</p></section>}

      {hasShopInsights && dashboardSection === 'insights' && <section className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-slate-800"><BarChart3 className="h-5 w-5 text-violet-600" /> Shop insights</h2><p className="mt-1 text-sm text-slate-600">{insightsPeriod === 'monthly' ? 'This month’s' : 'All-time'} activity from signed-in customers who engage with your shop.</p></div><div className="flex items-center gap-2"><div className="rounded-xl border border-violet-200 bg-white p-1"><button type="button" onClick={() => setInsightsPeriod('monthly')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${insightsPeriod === 'monthly' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>This month</button><button type="button" onClick={() => setInsightsPeriod('total')} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${insightsPeriod === 'total' ? 'bg-violet-600 text-white' : 'text-slate-600'}`}>Total</button></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">Pro feature</span></div></div>{insightsLoading ? <div className="mt-5 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading insights…</div> : insightsError ? <p className="mt-4 text-sm text-rose-600">{insightsError}</p> : <><div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5"><div className="rounded-xl border border-violet-100 bg-white p-4"><Eye className="h-4 w-4 text-violet-600" /><p className="mt-3 text-2xl font-extrabold text-slate-900">{insights?.views || 0}</p><p className="text-xs font-semibold text-slate-500">Catalog views</p><p className="mt-1 text-[11px] text-slate-400">{insights?.unique_viewers || 0} unique visitors</p></div><div className="rounded-xl border border-violet-100 bg-white p-4"><Navigation className="h-4 w-4 text-emerald-600" /><p className="mt-3 text-2xl font-extrabold text-slate-900">{insights?.directions || 0}</p><p className="text-xs font-semibold text-slate-500">Directions</p></div><div className="rounded-xl border border-violet-100 bg-white p-4"><PhoneCall className="h-4 w-4 text-sky-600" /><p className="mt-3 text-2xl font-extrabold text-slate-900">{insights?.calls || 0}</p><p className="text-xs font-semibold text-slate-500">Calls</p></div><div className="rounded-xl border border-violet-100 bg-white p-4"><MessageCircle className="h-4 w-4 text-emerald-600" /><p className="mt-3 text-2xl font-extrabold text-slate-900">{insights?.whatsapp_messages || 0}</p><p className="text-xs font-semibold text-slate-500">WhatsApp chats</p></div><div className="rounded-xl border border-violet-200 bg-violet-600 p-4 text-white"><BarChart3 className="h-4 w-4 text-violet-100" /><p className="mt-3 text-2xl font-extrabold">{insights?.total_interactions || 0}</p><p className="text-xs font-semibold text-violet-100">Total interactions</p></div></div><p className="mt-3 text-[11px] text-slate-500">Interactions include catalog views, calls, directions, WhatsApp chats, and reviews. Personal customer details are never shown.</p></>}</section>}

      {dashboardSection === 'offers' && <section className="mb-6 rounded-2xl border border-orange-100 bg-orange-50/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold text-slate-800"><Tag className="h-5 w-5 text-orange-600" /> Shop offers</h2><p className="mt-1 text-sm text-slate-600">Publish offers that customers can see from the Offers menu.</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">{shopOffers.filter((offer) => offer.is_active).length} active</span></div>
        <form onSubmit={handleCreateOffer} className="mt-5 grid gap-3 rounded-xl border border-orange-100 bg-white p-4 md:grid-cols-2">
          <input required maxLength="120" value={offerForm.title} onChange={(event) => setOfferForm({ ...offerForm, title: event.target.value })} placeholder="Offer title, e.g. Weekend grocery sale" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <input maxLength="80" value={offerForm.discount_text} onChange={(event) => setOfferForm({ ...offerForm, discount_text: event.target.value })} placeholder="Offer label, e.g. 20% OFF" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" />
          <textarea maxLength="500" rows="2" value={offerForm.description} onChange={(event) => setOfferForm({ ...offerForm, description: event.target.value })} placeholder="Short offer details or terms (optional)" className="resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm md:col-span-2" />
          <label className="text-xs font-semibold text-slate-600">Valid until (optional)<input type="date" min={todayIso} value={offerForm.valid_until} onChange={(event) => setOfferForm({ ...offerForm, valid_until: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
          <button disabled={offersLoading} className="self-end rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60">{offersLoading ? 'Saving…' : 'Publish offer'}</button>
        </form>
        {offerMessage && <p className={`mt-3 text-xs font-semibold ${offerMessage.includes('published') || offerMessage.includes('updated') ? 'text-emerald-700' : 'text-rose-600'}`}>{offerMessage}</p>}
        <div className="mt-4 space-y-2">
          {shopOffers.length === 0 ? <p className="rounded-xl border border-dashed border-orange-200 bg-white p-4 text-sm text-slate-500">No offers yet. Add your first offer above.</p> : shopOffers.map((offer) => <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-100 bg-white p-3"><div><p className="font-bold text-slate-800">{offer.discount_text && <span className="mr-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">{offer.discount_text}</span>}{offer.title}</p><p className="mt-1 text-xs text-slate-500">{offer.is_active ? 'Visible to customers' : 'Hidden'}{offer.valid_until ? ` · Valid until ${new Date(`${offer.valid_until}T00:00:00`).toLocaleDateString()}` : ''}</p></div><div className="flex gap-2"><button type="button" disabled={offersLoading} onClick={() => setEditingOffer({ ...offer, valid_until: offer.valid_until ? String(offer.valid_until).slice(0, 10) : '' })} className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-700">Edit</button><button type="button" disabled={offersLoading} onClick={() => updateOfferStatus(offer, !offer.is_active)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">{offer.is_active ? 'Hide' : 'Show'}</button><button type="button" disabled={offersLoading} onClick={() => deleteOffer(offer)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">Remove</button></div></div>)}
        </div>
      </section>}

      {editingOffer && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"><form onSubmit={handleUpdateOffer} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-800">Edit offer</h2><p className="mt-1 text-sm text-slate-500">Update the details customers see. Expiry can only be today or a future date.</p></div><button type="button" onClick={() => setEditingOffer(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3"><input required maxLength="120" value={editingOffer.title || ''} onChange={(event) => setEditingOffer({ ...editingOffer, title: event.target.value })} placeholder="Offer title" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><input maxLength="80" value={editingOffer.discount_text || ''} onChange={(event) => setEditingOffer({ ...editingOffer, discount_text: event.target.value })} placeholder="Offer label, e.g. 20% OFF" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><textarea maxLength="500" rows="3" value={editingOffer.description || ''} onChange={(event) => setEditingOffer({ ...editingOffer, description: event.target.value })} placeholder="Short offer details or terms (optional)" className="resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><label className="text-xs font-semibold text-slate-600">Valid until (optional)<input type="date" min={todayIso} value={editingOffer.valid_until || ''} onChange={(event) => setEditingOffer({ ...editingOffer, valid_until: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={offersLoading} onClick={() => setEditingOffer(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button disabled={offersLoading} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{offersLoading ? 'Saving…' : 'Save changes'}</button></div></form></div>}

      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Pencil className="h-4 w-4 text-emerald-600" /> Edit shop details</h3><button onClick={() => setEditingShop(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleUpdateShop} className="space-y-3">
              <input required value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} placeholder="Shop name" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <select required value={shopForm.category} onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="" disabled>Select category</option>{SHOP_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              <textarea rows="2" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} placeholder="Shop address" className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input type="tel" value={shopForm.phone} onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })} placeholder="Call number" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input type="tel" value={shopForm.whatsapp_number} onChange={(e) => setShopForm({ ...shopForm, whatsapp_number: e.target.value })} placeholder="WhatsApp number" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div>
              <input type="text" value={shopForm.opening_hours} onChange={(e) => setShopForm({ ...shopForm, opening_hours: e.target.value })} placeholder="Opening hours" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-slate-600">Open time<input type="time" value={shopForm.opening_time} onChange={(e) => setShopForm({ ...shopForm, opening_time: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Close time<input type="time" value={shopForm.closing_time} onChange={(e) => setShopForm({ ...shopForm, closing_time: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label></div>
              <div className="grid grid-cols-2 gap-3"><input type="number" step="any" value={shopForm.latitude} onChange={(e) => setShopForm({ ...shopForm, latitude: e.target.value })} placeholder="Latitude" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input type="number" step="any" value={shopForm.longitude} onChange={(e) => setShopForm({ ...shopForm, longitude: e.target.value })} placeholder="Longitude" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div>
              <input type="url" value={shopForm.google_map_link} onChange={(e) => setShopForm({ ...shopForm, google_map_link: e.target.value })} placeholder="Google Maps link (optional)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setEditingShop(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white">{loading ? 'Saving...' : 'Save details'}</button></div>
            </form>
          </div>
        </div>
      )}

      {dashboardSection === 'catalog' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Product Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
          <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" /> Add Product
          </h3>
          <form onSubmit={handleAddProduct} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name *</label>
              <input type="text" required placeholder="e.g. Rice 5kg" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Price (₹) *</label>
              <input type="number" required placeholder="250" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Brand / model</label>
              <input type="text" placeholder="e.g. HP 65W" value={newProduct.brand} onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea rows="2" placeholder="Compatibility, size, or useful details" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} className="w-full resize-none px-3 py-2 border border-slate-300 rounded-xl text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Availability *</label>
              <select value={newProduct.availability_status} onChange={(e) => setNewProduct({ ...newProduct, availability_status: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Product Image (Optional)</label>

              <div className="flex items-center gap-2">
                <label className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer flex items-center justify-center gap-1 hover:bg-slate-100">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" /> Upload Image File
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageFileUpload(e, false)} className="hidden" />
                </label>
              </div>

              <div className="text-[10px] text-slate-400 text-center">OR Paste Image URL</div>

              <input type="url" placeholder="https://example.com/image.jpg" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white" />

              <p className="text-center text-[10px] text-slate-500">Uploads are resized and optimized for faster loading.</p>
              {imageUploadMessage && <p className={`text-center text-[10px] font-medium ${imageUploadMessage.includes('ready') ? 'text-emerald-700' : imageUploadMessage.includes('Optimizing') ? 'text-slate-500' : 'text-rose-600'}`}>{imageUploadMessage}</p>}

              {newProduct.image_url && (
                <div className="mt-2 text-center">
                  <p className="text-[10px] text-slate-500 mb-1">Image Preview:</p>
                  <img src={newProduct.image_url} alt="Preview" className="w-16 h-16 object-cover mx-auto rounded-lg border border-slate-300" />
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm hover:bg-emerald-700 transition cursor-pointer flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding Product...</> : 'Add Product'}
            </button>
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800">Bulk upload products (CSV)</p><p className="mt-1 text-[11px] text-slate-600">Create an Excel/Google Sheet file, then download it as <strong>.csv</strong>.</p><ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-slate-600"><li>First row must contain the column titles in this order.</li><li>Each next row is one product.</li><li><strong>name</strong> and <strong>price</strong> are required; all other fields are optional.</li></ol><div className="mt-3 overflow-x-auto rounded-lg border border-emerald-100 bg-white p-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">CSV example</p><pre className="text-[10px] leading-5 text-slate-700">name,price,brand,description,availability_status,image_url{`\n`}Rice Bag,850,India Gate,5 kg basmati rice,available,{`\n`}Milk,32,Aavin,Fresh milk,low_stock,</pre></div><a download="nearbuy-products-sample.csv" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('name,price,brand,description,availability_status,image_url\nRice Bag,850,India Gate,5 kg basmati rice,available,\nMilk,32,Aavin,Fresh milk,low_stock,')} className="mt-3 block text-center text-[11px] font-bold text-emerald-700 hover:underline">Download sample CSV</a><label className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700"><Upload className="h-3.5 w-3.5" />Choose CSV file<input type="file" accept=".csv,text/csv" onChange={handleBulkFile} className="hidden" /></label>{bulkMessage && <p className="mt-2 text-[11px] font-medium text-slate-600">{bulkMessage}</p>}</div>
          </form>
        </div>

        {/* Product List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-lg">Listed Products ({products.length})</h3>
            <div className="flex items-center gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><Search className="h-4 w-4 text-slate-400" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products" className="w-36 bg-transparent text-sm outline-none" /></label>{fetchingProducts && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}</div>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">No products added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add your first product using the form on the left.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No products match “{productSearch}”.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.map((p) => (
                <div key={p.id} className="border border-slate-200 rounded-xl p-3 transition hover:border-emerald-300 bg-white shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img 
                      src={p.image_url && p.image_url.trim() !== '' ? p.image_url : productFallbackImage(p)}
                      alt={p.name} 
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 object-cover rounded-lg bg-slate-100 border border-slate-100 shrink-0" 
                      onError={(e) => { e.target.src = productFallbackImage(p); }}
                    />
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{p.name}</h4>
                      <p className="text-sm font-extrabold text-emerald-600 mt-0.5">₹{p.price}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${availabilityBadgeClass(p.availability_status)}`}>{availabilityLabel(p.availability_status)}</span>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1 font-semibold text-amber-700"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.average_rating || 0).toFixed(1)} ({p.review_count || 0})</span><span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />Added {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'recently'}</span></div>
                    </div>
                  </div>

                  <div className="flex shrink-0">
                    <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition cursor-pointer" title="Edit Product"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteProduct(p)} disabled={loading} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50" title="Delete Product"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  </div>
                  <label className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">Quick stock update<select value={p.availability_status || 'available'} disabled={updatingStockId === p.id} onChange={(event) => handleQuickStockUpdate(p, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 disabled:opacity-50">{AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>}

      {/* EDIT PRODUCT MODAL POPUP */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" /> Edit Product
              </h3>
              <button 
                onClick={() => setEditingProduct(null)} 
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Product Name *</label>
                <input 
                  type="text" 
                  required 
                  value={editingProduct.name} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Price (₹) *</label>
                <input 
                  type="number" 
                  required 
                  value={editingProduct.price} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Brand / model</label>
                <input type="text" value={editingProduct.brand || ''} onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea rows="2" value={editingProduct.description || ''} onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })} className="w-full resize-none px-3 py-2 border border-slate-300 rounded-xl text-sm" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Availability *</label>
                <select value={editingProduct.availability_status || 'available'} onChange={(e) => setEditingProduct({ ...editingProduct, availability_status: e.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                  {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Product Image (Optional)</label>

                <div className="flex items-center gap-2">
                  <label className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-600 cursor-pointer flex items-center justify-center gap-1 hover:bg-slate-100">
                    <Upload className="w-3.5 h-3.5 text-emerald-600" /> Upload Image File
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageFileUpload(e, true)} className="hidden" />
                  </label>
                </div>

                <div className="text-[10px] text-slate-400 text-center">OR Paste Image URL</div>

                <input 
                  type="url" 
                  placeholder="https://example.com/image.jpg" 
                  value={editingProduct.image_url || ''} 
                  onChange={(e) => setEditingProduct({ ...editingProduct, image_url: e.target.value })} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white" 
                />
                <p className="text-center text-[10px] text-slate-500">Uploads are resized and optimized for faster loading.</p>
                {imageUploadMessage && <p className={`text-center text-[10px] font-medium ${imageUploadMessage.includes('ready') ? 'text-emerald-700' : imageUploadMessage.includes('Optimizing') ? 'text-slate-500' : 'text-rose-600'}`}>{imageUploadMessage}</p>}

                {editingProduct.image_url && (
                  <div className="mt-2 text-center">
                    <p className="text-[10px] text-slate-500 mb-1">Image Preview:</p>
                    <img src={editingProduct.image_url} alt="Preview" className="w-16 h-16 object-cover mx-auto rounded-lg border border-slate-300" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)} 
                  className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer flex items-center justify-center gap-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyShop;
