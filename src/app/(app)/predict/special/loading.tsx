export default function SpecialLoading() {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="h-8 w-72 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted/70" />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-12 animate-pulse rounded-md bg-muted/50" />
          </div>
        ))}
      </div>
    </section>
  );
}
