export default function GroupsLoading() {
  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded-md bg-muted/70" />
          </div>
          <div className="h-8 w-32 animate-pulse rounded-full bg-muted/70" />
        </div>
      </header>

      <div className="grid grid-cols-6 gap-1 sm:grid-cols-12">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md bg-muted/70"
          />
        ))}
      </div>

      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card"
          >
            <div className="border-b border-border/60 bg-muted/40 px-3 py-2">
              <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4">
              <div className="flex items-center gap-2 justify-end">
                <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
                <div className="h-7 w-10 animate-pulse rounded-sm bg-muted" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-11 w-12 animate-pulse rounded-lg bg-muted" />
                <span className="text-muted-foreground">–</span>
                <div className="h-11 w-12 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-10 animate-pulse rounded-sm bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
