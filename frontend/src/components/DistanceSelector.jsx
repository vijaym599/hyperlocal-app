import { LocateFixed, Check } from 'lucide-react';

const distances = ['', '2', '5', '10', '20', '50'];

export default function DistanceSelector({ value, onChange }) {
  return (
    <div className="min-w-0 border-t border-slate-100 px-1 pb-1 pt-2 sm:px-3 sm:pb-2 sm:pt-3">
      <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2.5">
        <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 sm:h-7 sm:w-7"><LocateFixed className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /></span>
          Search distance
        </span>
        <span className="text-[11px] font-medium text-slate-500">{value ? `Within ${value} km of you` : 'Global search · 5000 km'}</span>
      </div>
      <div role="group" aria-label="Search distance" className="scrollbar-none flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-6 sm:overflow-visible sm:pb-0">
        {distances.map((distance) => {
          const selected = value === distance;
          return (
            <button
              key={distance || 'all'}
              type="button"
              aria-pressed={selected}
              aria-label={distance ? `Within ${distance} kilometres` : 'Global search up to 5000 kilometres'}
              onClick={() => onChange(distance)}
              className={`flex min-h-9 min-w-[78px] shrink-0 snap-start items-center justify-center gap-1 rounded-xl border px-2 py-1.5 text-xs font-bold transition duration-200 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:min-h-11 sm:min-w-0 sm:shrink ${selected ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'}`}
            >
              {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {distance ? <span>{distance}<span className={`ml-1 text-[10px] font-medium ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>km</span></span> : 'Global'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
