export default function MeLoading() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded-md bg-muted/70" />
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
              <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
            </div>
            <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-1 h-3 w-24 animate-pulse rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </section>
  );
}
