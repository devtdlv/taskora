export default function ProjectLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading project</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-64 max-w-full" />
        <div className="tk-skeleton mt-4 h-7 w-56" />
        <div className="tk-skeleton mt-3 h-4 w-96 max-w-full" />

        <div className="tk-skeleton mt-10 h-5 w-20" />

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, column) => (
            <div
              key={column}
              className="rounded-xl border border-line bg-zinc-100/70 p-3"
            >
              <div className="tk-skeleton mb-3 h-4 w-24" />
              <div className="space-y-3">
                {Array.from({ length: 2 }, (_, card) => (
                  <div key={card} className="tk-card p-4">
                    <div className="tk-skeleton h-4 w-3/4" />
                    <div className="tk-skeleton mt-3 h-3 w-1/2" />
                    <div className="tk-skeleton mt-3 h-8 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
