export default function LeaderboardLoading() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-muted/70" />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="space-y-1 text-right">
                <div className="h-7 w-14 animate-pulse rounded bg-muted" />
                <div className="h-3 w-10 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1 rounded-2xl border border-border bg-card p-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-2 py-2.5"
          >
            <div className="h-3 w-4 animate-pulse rounded bg-muted" />
            <div className="h-7 w-7 animate-pulse rounded-full bg-muted" />
            <div className="h-4 flex-1 max-w-[160px] animate-pulse rounded bg-muted/70" />
            <div className="h-4 w-8 animate-pulse rounded bg-muted ml-auto" />
          </div>
        ))}
      </div>
    </section>
  );
}
