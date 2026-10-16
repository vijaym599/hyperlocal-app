import { Moon, Sun } from 'lucide-react';

export default function ThemePreference({ theme = 'light', onToggleTheme, className = '' }) {
  const dark = theme === 'dark';
  const Icon = dark ? Moon : Sun;

  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-black text-slate-900">Appearance</h3>
          <p className="mt-1 text-xs text-slate-500">Choose how Nearbuy looks on this device.</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label="Dark mode"
        onClick={onToggleTheme}
        className="flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <span>{dark ? 'Dark' : 'Light'}</span>
        <span aria-hidden="true" className={`relative h-7 w-12 overflow-hidden rounded-full transition-colors ${dark ? 'bg-emerald-600' : 'bg-slate-300'}`}>
          <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${dark ? 'translate-x-6' : 'translate-x-1'}`} />
        </span>
      </button>
    </div>
  </section>;
}
