import { indianLocalPhone } from '../phone.mjs';

export default function IndianPhoneInput({ value, onChange, className = '', label = 'Mobile number', required = true }) {
  return <label className="block">
    <span className="sr-only">{label}</span>
    <span className={`flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100 ${className}`}>
      <span aria-hidden="true" className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">+91</span>
      <input type="tel" inputMode="numeric" autoComplete="tel-national" required={required} pattern="[6-9][0-9]{9}" minLength={required ? 10 : undefined} maxLength={10} aria-label={label} placeholder={`Enter ${label.toLowerCase()} (10 digits${required ? '' : ', optional'})`} value={indianLocalPhone(value)} onChange={(event) => onChange(indianLocalPhone(event.target.value))} className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" />
    </span>
  </label>;
}
