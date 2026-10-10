export default function TaskLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading task</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-72 max-w-full" />

        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_240px] lg:gap-8">
          <div className="tk-card p-5 sm:p-8">
            <div className="tk-skeleton h-7 w-2/3" />
            <div className="tk-skeleton mt-5 h-4 w-full" />
            <div className="tk-skeleton mt-2 h-4 w-5/6" />

            <div className="mt-10 border-t border-line pt-8">
              <div className="tk-skeleton h-5 w-28" />
              <div className="tk-skeleton mt-4 h-20 w-full" />
            </div>
          </div>

          <div className="tk-card space-y-6 p-5 md:self-start">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index}>
                <div className="tk-skeleton h-4 w-20" />
                <div className="tk-skeleton mt-2 h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
