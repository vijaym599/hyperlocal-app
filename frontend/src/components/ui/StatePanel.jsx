import {
  AlertTriangle, ArrowLeft, FileQuestion, Inbox, LoaderCircle, LockKeyhole,
  House, RefreshCw, SearchX, ServerCrash, ShieldX, WifiOff
} from 'lucide-react';
import { errorPresentation } from '../../requestState.mjs';

const iconByKind = {
  empty: Inbox,
  search: SearchX,
  offline: WifiOff,
  unauthorized: LockKeyhole,
  forbidden: ShieldX,
  'not-found': FileQuestion,
  'rate-limit': AlertTriangle,
  server: ServerCrash,
  error: AlertTriangle,
};

const toneByKind = {
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
  search: 'border-sky-200 bg-sky-50 text-sky-700',
  offline: 'border-amber-200 bg-amber-50 text-amber-800',
  unauthorized: 'border-amber-200 bg-amber-50 text-amber-800',
  forbidden: 'border-rose-200 bg-rose-50 text-rose-700',
  'not-found': 'border-slate-200 bg-slate-50 text-slate-700',
  'rate-limit': 'border-amber-200 bg-amber-50 text-amber-800',
  server: 'border-rose-200 bg-rose-50 text-rose-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function StatePanel({
  kind = 'empty', title, description, icon: Icon = iconByKind[kind] || Inbox,
  primaryAction, secondaryAction, compact = false, className = '', role,
}) {
  const resolvedRole = role || (['error', 'server', 'offline', 'unauthorized', 'forbidden'].includes(kind) ? 'alert' : 'status');
  const ActionIcon = kind === 'unauthorized' ? LockKeyhole : kind === 'search' ? SearchX : kind === 'not-found' ? House : RefreshCw;
  return (
    <section
      role={resolvedRole}
      aria-live={resolvedRole === 'alert' ? 'assertive' : 'polite'}
      className={`neo-panel overflow-hidden rounded-3xl border bg-white/80 text-center ${compact ? 'p-5' : 'px-5 py-10 sm:px-8 sm:py-12'} ${className}`}
    >
      <span className={`mx-auto flex items-center justify-center rounded-2xl border ${compact ? 'h-11 w-11' : 'h-14 w-14'} ${toneByKind[kind] || toneByKind.empty}`}>
        <Icon aria-hidden="true" className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
      </span>
      <h2 className={`${compact ? 'mt-3 text-base' : 'mt-5 text-xl'} font-black text-slate-900`}>{title}</h2>
      {description && <p className={`mx-auto max-w-xl leading-6 text-slate-500 ${compact ? 'mt-1 text-xs' : 'mt-2 text-sm'}`}>{description}</p>}
      {(primaryAction || secondaryAction) && <div className="mt-5 flex flex-wrap justify-center gap-2">
        {primaryAction && <button type="button" onClick={primaryAction.onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"><ActionIcon className="h-4 w-4" />{primaryAction.label}</button>}
        {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />{secondaryAction.label}</button>}
      </div>}
    </section>
  );
}

export function ErrorState({ error, onRetry, onBack, retryLabel = 'Try again', compact = false, className = '' }) {
  const presentation = errorPresentation(error);
  return <StatePanel kind={presentation.kind} title={presentation.title} description={presentation.description} compact={compact} className={className} primaryAction={onRetry ? { label: retryLabel, onClick: onRetry } : undefined} secondaryAction={onBack ? { label: 'Go back', onClick: onBack } : undefined} />;
}

export function EmptyState({ title, description, onAction, actionLabel = 'Refresh', kind = 'empty', icon, compact = false, className = '' }) {
  return <StatePanel kind={kind} icon={icon} title={title} description={description} compact={compact} className={className} primaryAction={onAction ? { label: actionLabel, onClick: onAction } : undefined} />;
}

export function LoadingState({ label = 'Loading…', rows = 3, compact = false, className = '' }) {
  return <section role="status" aria-live="polite" aria-busy="true" className={`neo-panel rounded-3xl border border-slate-200 bg-white/70 ${compact ? 'p-4' : 'p-6 sm:p-8'} ${className}`}><div className="flex items-center gap-3 text-sm font-bold text-slate-600"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-emerald-600" /><span>{label}</span></div><span className="sr-only">Please wait</span><div aria-hidden="true" className="mt-5 space-y-3">{Array.from({ length: rows }, (_, index) => <div key={index} className={`neo-inset animate-pulse rounded-xl ${index === rows - 1 ? 'h-10 w-2/3' : 'h-14 w-full'}`} />)}</div></section>;
}

export function FeedbackBanner({ tone = 'error', children, className = '' }) {
  const styles = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-700';
  return <div role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'} className={`rounded-xl border p-3 text-sm ${styles} ${className}`}>{children}</div>;
}
