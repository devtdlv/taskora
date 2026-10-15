export default function ProjectAnalyticsLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading analytics</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-64 max-w-full" />
        <div className="tk-skeleton mt-4 h-7 w-56" />
        <div className="tk-skeleton mt-3 h-4 w-72 max-w-full" />
        <div className="tk-skeleton mt-6 h-9 w-48" />

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="tk-card p-4 sm:p-5">
              <div className="tk-skeleton h-4 w-20" />
              <div className="tk-skeleton mt-2 h-7 w-10" />
            </div>
          ))}
        </div>

        <div className="tk-card mt-4 p-5 sm:p-6">
          <div className="tk-skeleton h-4 w-24" />
          <div className="tk-skeleton mt-4 h-2.5 w-full" />
        </div>

        <div className="tk-card mt-4 p-5 sm:p-6">
          <div className="tk-skeleton h-4 w-20" />
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="tk-skeleton mt-4 h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
