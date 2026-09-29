export default function AboutContent() {
  return (
    <main>
      {/* 1. Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="bg-blue-500/30 text-blue-100 text-xs font-semibold px-4 py-1.5 rounded-full uppercase tracking-wider">
            Digitalizing Local Shops
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold mt-4 mb-6 leading-tight">
            A New Revolution Bringing Local Businesses to the Digital World!
          </h1>
          <p className="text-base md:text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
            A modern platform to discover local shops and products around your area in seconds.
          </p>
        </div>
      </section>

      {/* 2. What is this App? */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
              What is this App?
            </h2>
            <p className="text-slate-600 mb-4 leading-relaxed">
              This is a <strong>Hyperlocal Marketplace</strong> that connects buyers with local shop owners in their nearby area using a live location map.
            </p>
            <p className="text-slate-600 leading-relaxed">
              Instead of ordering on large e-commerce platforms and waiting for days, this platform helps you check product availability in nearby shops and buy what you need instantly.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 grid grid-cols-2 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-xl">
              <span className="text-3xl block mb-2">📍</span>
              <h3 className="font-bold text-slate-900">Geo Search</h3>
              <p className="text-xs text-slate-500 mt-1">Accurate distance calculation</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-xl">
              <span className="text-3xl block mb-2">🏪</span>
              <h3 className="font-bold text-slate-900">Local Shops</h3>
              <p className="text-xs text-slate-500 mt-1">Discover nearby stores</p>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
              <span className="text-3xl block mb-2">📦</span>
              <h3 className="font-bold text-slate-900">Live Stock</h3>
              <p className="text-xs text-slate-500 mt-1">Real-time product availability</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-xl">
              <span className="text-3xl block mb-2">🗺️</span>
              <h3 className="font-bold text-slate-900">Direct Route</h3>
              <p className="text-xs text-slate-500 mt-1">Google Maps navigation</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How It Works */}
      <section className="py-16 bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">How It Works</h2>
            <p className="text-slate-600 mt-2">Simple process in 3 easy steps</p>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Customer Flow */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-3 mb-6">
                <span className="bg-blue-600 text-white p-3 rounded-lg text-xl">👤</span>
                <h3 className="text-xl font-bold text-slate-900">For Buyers</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">1</span>
                  <span className="text-slate-700">Enable your <strong>Location Permission</strong> and search for the product you need.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">2</span>
                  <span className="text-slate-700">See which shop has the item and how many <strong>Kilometers (KM)</strong> away it is.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="bg-blue-100 text-blue-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">3</span>
                  <span className="text-slate-700">Use Google Maps navigation to visit the shop and purchase immediately.</span>
                </li>
              </ul>
            </div>

            {/* Business Flow */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200">
              <div className="flex items-center space-x-3 mb-6">
                <span className="bg-indigo-600 text-white p-3 rounded-lg text-xl">🏬</span>
                <h3 className="text-xl font-bold text-slate-900">For Shop Owners</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start space-x-3">
                  <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">1</span>
                  <span className="text-slate-700">Register your shop details and location (Shop Registration).</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">2</span>
                  <span className="text-slate-700">Upload products you sell along with their prices and photos.</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0 mt-0.5">3</span>
                  <span className="text-slate-700">Attract nearby customers directly to your shop and scale your business.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Business Growth Tips */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900">How to Grow Your Business Using This App?</h2>
          <p className="text-slate-600 mt-2">Useful strategies for local store owners</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <span className="text-3xl block mb-4">📢</span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">1. Online Visibility</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Even shops located off main roads will become visible on the mobile screens of all nearby customers by listing here.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <span className="text-3xl block mb-4">🏷️</span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">2. Promote Local Offers</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Instantly list new stock or festive discounts to attract shoppers in your vicinity.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <span className="text-3xl block mb-4">🤝</span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">3. Direct Customer Relationships</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Since buyers visit your store directly without middleman commissions, you can build lasting customer loyalty.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}