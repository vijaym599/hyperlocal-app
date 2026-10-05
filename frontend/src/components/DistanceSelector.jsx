import { LocateFixed, Check } from 'lucide-react';

const distances = ['', '2', '5', '10', '20', '50'];

export default function DistanceSelector({ value, onChange }) {
  return (
    <div className="min-w-0 border-t border-slate-100 px-2 pb-2 pt-3 sm:px-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><LocateFixed className="h-4 w-4" aria-hidden="true" /></span>
          Search distance
        </span>
        <span className="text-[11px] font-medium text-slate-500">{value ? `Within ${value} km of you` : 'Explore all distances'}</span>
      </div>
      <div role="group" aria-label="Search distance" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {distances.map((distance) => {
          const selected = value === distance;
          return (
            <button
              key={distance || 'all'}
              type="button"
              aria-pressed={selected}
              aria-label={distance ? `Within ${distance} kilometres` : 'All distances'}
              onClick={() => onChange(distance)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition duration-200 motion-safe:active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${selected ? 'border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'}`}
            >
              {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {distance ? <span>{distance}<span className={`ml-1 text-[10px] font-medium ${selected ? 'text-emerald-100' : 'text-slate-400'}`}>km</span></span> : 'All distances'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
