export default function TaskLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading task</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-72 max-w-full" />

        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:grid-rows-[auto_1fr] lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-8">
          <div className="tk-card p-5 sm:p-8 md:col-start-1">
            <div className="tk-skeleton h-7 w-2/3" />
            <div className="tk-skeleton mt-6 h-3 w-24" />
            <div className="tk-skeleton mt-3 h-4 w-full" />
            <div className="tk-skeleton mt-2 h-4 w-5/6" />
          </div>

          <div className="tk-card md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
            <div className="border-b border-line px-5 py-4">
              <div className="tk-skeleton h-4 w-20" />
            </div>
            <div className="space-y-5 p-5">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index}>
                  <div className="tk-skeleton h-4 w-20" />
                  <div className="tk-skeleton mt-2 h-10 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="tk-card p-5 sm:p-8 md:col-start-1">
            <div className="tk-skeleton h-5 w-28" />
            <div className="tk-skeleton mt-4 h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
