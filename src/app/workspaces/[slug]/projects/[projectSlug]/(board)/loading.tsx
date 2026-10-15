export default function ProjectLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading project</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-64 max-w-full" />
        <div className="tk-skeleton mt-4 h-7 w-56" />
        <div className="tk-skeleton mt-3 h-4 w-96 max-w-full" />

        <div className="tk-skeleton mt-10 h-5 w-20" />

        <div className="mt-4 grid gap-4 md:grid-cols-3 md:items-start">
          {Array.from({ length: 3 }, (_, column) => (
            <div
              key={column}
              className="rounded-xl border border-line bg-zinc-100/60 p-2"
            >
              <div className="tk-skeleton mx-2 mt-1.5 mb-2.5 h-4 w-24" />
              <div className="space-y-2">
                {Array.from({ length: 2 }, (_, card) => (
                  <div
                    key={card}
                    className="rounded-lg border border-line bg-surface p-3 shadow-xs"
                  >
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
