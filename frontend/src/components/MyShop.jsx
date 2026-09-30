import { useState, useEffect } from 'react';
import { Store, Package, Plus, UserPlus, LogIn, ArrowLeft, Loader2, Upload, RefreshCw, LogOut, Pencil, X, Tag, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const SUBSCRIPTION_PLANS = [
  { id: 'free', name: 'Free', price: 0, limit: 10, desc: 'Starter plan for small local vendors' },
  { id: 'basic', name: 'Basic', price: 199, limit: 50, desc: 'Great for growing neighborhood stores' },
  { id: 'pro', name: 'Pro', price: 499, limit: 200, desc: 'Ideal for established retail outlets' },
  { id: 'advance', name: 'Advance', price: 999, limit: 500, desc: 'For large stores with wide catalog' },
  { id: 'enterprise', name: 'Enterprise', price: 1999, limit: 999999, desc: 'Unlimited products & priority support' }
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

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=300';
const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'low_stock', label: 'Low stock' },
  { value: 'out_of_stock', label: 'Out of stock' }
];

const availabilityBadgeClass = (status) => ({
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
  out_of_stock: 'bg-rose-50 text-rose-700 border-rose-200'
}[status] || 'bg-slate-50 text-slate-600 border-slate-200');

const availabilityLabel = (status) => AVAILABILITY_OPTIONS.find((item) => item.value === status)?.label || 'Available';

const MyShop = ({ session, onLoginSuccess, onLogout }) => {
  const [viewMode, setViewMode] = useState(session?.token ? 'dashboard' : 'choice');
  const [wizardStep, setWizardStep] = useState(1);

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [shopData, setShopData] = useState(session?.shop || null);
  const [products, setProducts] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  // REGISTRATION FORM WITH CATEGORY
  const [regForm, setRegForm] = useState({
    owner_name: '',
    email: '',
    password: '',
    shop_name: '',
    category: '', // Added Category
    address: '',
    phone: '',
    whatsapp_number: '',
    opening_hours: '',
    google_map_link: '',
    latitude: '',
    longitude: '',
    selected_plan: 'free'
  });

  const [newProduct, setNewProduct] = useState({ name: '', brand: '', description: '', price: '', image_url: '', availability_status: 'available' });
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingShop, setEditingShop] = useState(false);
  const [shopForm, setShopForm] = useState({ name: '', category: '', address: '', phone: '', whatsapp_number: '', opening_hours: '', latitude: '', longitude: '', google_map_link: '' });

  const activePlanDetails = SUBSCRIPTION_PLANS.find(p => p.id === (shopData?.subscription_plan || 'free')) || SUBSCRIPTION_PLANS[0];
  const maxProductsAllowed = activePlanDetails.limit;
  const authenticatedJsonHeaders = () => ({
    'Content-Type': 'application/json',
    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
  });

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

  const handleImageFileUpload = (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingProduct(prev => ({ ...prev, image_url: reader.result }));
        } else {
          setNewProduct(prev => ({ ...prev, image_url: reader.result }));
        }
      };
      reader.readAsDataURL(file);
    }
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

  const handleOpenStatus = async () => {
    if (!shopData?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shops/${shopData.id}/open-status`, {
        method: 'PATCH',
        headers: authenticatedJsonHeaders(),
        body: JSON.stringify({ is_open: !(shopData.is_open !== false) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update shop status.');
      setShopData(data.shop);
      const updatedSession = { ...session, shop: data.shop };
      localStorage.setItem('hyperlocal-session', JSON.stringify(updatedSession));
      onLoginSuccess?.(updatedSession);
    } catch (error) {
      alert(error.message);
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
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input type="email" required placeholder="owner@shop.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <input type="password" required placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
          </div>
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
            <input type="email" required placeholder="Email *" value={regForm.email} onChange={(e) => setRegForm({ ...regForm, email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            <input type="password" required minLength={8} placeholder="Password (minimum 8 characters) *" value={regForm.password} onChange={(e) => setRegForm({ ...regForm, password: e.target.value })} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm" />
            
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
                    onClick={() => handleRegisterSubmit(plan.id, plan.price === 0 ? null : 'MOCK_PAY_' + Date.now())} 
                    disabled={loading} 
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating Shop...</> : `Select ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
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
          <h1 className="text-2xl font-bold">{shopData?.name || 'My Shop'}</h1>
          <p className="text-xs text-slate-400 mt-1">
            Plan: <span className="text-emerald-400 font-bold uppercase">{shopData?.subscription_plan || 'Free'}</span> ({products.length} / {maxProductsAllowed >= 9999 ? '∞' : maxProductsAllowed} Products)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleOpenStatus} disabled={loading} className={`p-2 rounded-xl transition flex items-center gap-1 text-xs cursor-pointer ${shopData?.is_open !== false ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-white'}`} title="Update open status">
            <span className="hidden sm:inline">{shopData?.is_open !== false ? 'Open now' : 'Closed'}</span>
            <span className="sm:hidden">{shopData?.is_open !== false ? 'Open' : 'Closed'}</span>
          </button>
          <button onClick={openShopEditor} className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-1 text-xs cursor-pointer" title="Edit shop details">
            <Pencil className="w-4 h-4" /><span className="hidden sm:inline">Edit Shop</span>
          </button>
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
              <div className="grid grid-cols-2 gap-3"><input type="number" step="any" value={shopForm.latitude} onChange={(e) => setShopForm({ ...shopForm, latitude: e.target.value })} placeholder="Latitude" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input type="number" step="any" value={shopForm.longitude} onChange={(e) => setShopForm({ ...shopForm, longitude: e.target.value })} placeholder="Longitude" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div>
              <input type="url" value={shopForm.google_map_link} onChange={(e) => setShopForm({ ...shopForm, google_map_link: e.target.value })} placeholder="Google Maps link (optional)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              <div className="flex gap-2 pt-2"><button type="button" onClick={() => setEditingShop(false)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={loading} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white">{loading ? 'Saving...' : 'Save details'}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, false)} className="hidden" />
                </label>
              </div>

              <div className="text-[10px] text-slate-400 text-center">OR Paste Image URL</div>

              <input type="url" placeholder="https://example.com/image.jpg" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white" />

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
          </form>
        </div>

        {/* Product List */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Listed Products ({products.length})</h3>
            {fetchingProducts && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
          </div>

          {products.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500">No products added yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add your first product using the form on the left.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-emerald-300 transition bg-white shadow-2xs">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img 
                      src={p.image_url && p.image_url.trim() !== '' ? p.image_url : DEFAULT_IMAGE} 
                      alt={p.name} 
                      className="w-16 h-16 object-cover rounded-lg bg-slate-100 border border-slate-100 shrink-0" 
                      onError={(e) => { e.target.src = DEFAULT_IMAGE; }}
                    />
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{p.name}</h4>
                      <p className="text-sm font-extrabold text-emerald-600 mt-0.5">₹{p.price}</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${availabilityBadgeClass(p.availability_status)}`}>{availabilityLabel(p.availability_status)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0">
                    <button onClick={() => setEditingProduct(p)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-50 rounded-lg transition cursor-pointer" title="Edit Product"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteProduct(p)} disabled={loading} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-50" title="Delete Product"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                    <input type="file" accept="image/*" onChange={(e) => handleImageFileUpload(e, true)} className="hidden" />
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
