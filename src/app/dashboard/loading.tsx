export default function DashboardLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading dashboard</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-7 w-56" />
        <div className="tk-skeleton mt-3 h-4 w-80 max-w-full" />

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="tk-card p-4 sm:p-5">
              <div className="tk-skeleton h-4 w-24" />
              <div className="tk-skeleton mt-3 h-8 w-12" />
              <div className="tk-skeleton mt-2 h-3 w-28 max-w-full" />
            </div>
          ))}
        </div>

        <div className="tk-skeleton mt-10 h-5 w-36" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="tk-card p-5">
              <div className="flex items-start gap-3">
                <div className="tk-skeleton size-10" />
                <div className="flex-1">
                  <div className="tk-skeleton h-4 w-32" />
                  <div className="tk-skeleton mt-2 h-3 w-20" />
                </div>
              </div>
              <div className="mt-5 border-t border-line pt-4">
                <div className="tk-skeleton h-4 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
