export default function ProductSkeleton() {
  return <div role="status" aria-label="Loading nearby products">
    <p className="mb-4 text-sm text-slate-500">Finding nearby products…</p>
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 10 }, (_, index) => <div key={index} className="rounded-3xl border border-slate-200 bg-white p-3 motion-safe:animate-pulse">
        <div className="h-44 rounded-2xl bg-slate-200" />
        <div className="mt-4 h-4 w-3/4 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-1/3 rounded bg-slate-100" />
        <div className="mt-4 h-10 rounded-xl bg-slate-100" />
      </div>)}
    </div>
  </div>;
}
