export default function Footer({ setActiveTab }) {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 mt-auto">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Info */}
        <div className="space-y-4">
          <h3 className="text-white text-xl font-bold flex items-left space-x-2">
            <span className="text-blue-500">📍</span>
            <span>NearBuy</span>
          </h3>
          <p className="text-sm text-slate-400 text-left">
            Your modern guide to discovering nearby local shops and products instantly.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-white font-semibold mb-4 text-left">Quick Links</h4>
          <ul className="space-y-2 text-sm text-left">
            <li>
              <button 
                onClick={() => setActiveTab && setActiveTab('explore')} 
                className="hover:text-blue-400 transition text-left cursor-pointer"
              >
                Home
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab && setActiveTab('about')} 
                className="hover:text-blue-400 transition text-left cursor-pointer"
              >
                About Us
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab && setActiveTab('explore')} 
                className="hover:text-blue-400 transition text-left cursor-pointer"
              >
                Shops
              </button>
            </li>
          </ul>
        </div>

        {/* Business Owners */}
        <div>
          <h4 className="text-white font-semibold mb-4 text-left">For Shop Owners</h4>
          <ul className="space-y-2 text-sm text-left">
            <li>
              <button 
                onClick={() => setActiveTab && setActiveTab('my-shop')} 
                className="hover:text-blue-400 transition text-left cursor-pointer"
              >
                Register Your Shop
              </button>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="text-white font-semibold mb-4 text-left">Contact Us</h4>
          <p className="text-sm text-slate-400 mb-3 flex text-left gap-2">
            ✉️ support@nearbuy.com
          </p>
          <div className="flex space-x-3">
            <a href="#" className="w-9 h-9 bg-slate-800 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition">FB</a>
            <a href="#" className="w-9 h-9 bg-slate-800 hover:bg-sky-500 text-white rounded-full flex items-center justify-center transition">X</a>
            <a href="#" className="w-9 h-9 bg-slate-800 hover:bg-pink-600 text-white rounded-full flex items-center justify-center transition">IG</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-12 pt-6 border-t border-slate-800 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} NearBuy. All rights reserved.
      </div>
    </footer>
  );
}