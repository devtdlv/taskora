export default function MembersLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading members</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-56" />
        <div className="tk-skeleton mt-4 h-7 w-32" />
        <div className="tk-skeleton mt-3 h-4 w-64 max-w-full" />

        <div className="tk-skeleton mt-10 h-5 w-20" />

        <div className="tk-card mt-4 divide-y divide-zinc-200">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <div className="tk-skeleton size-9 rounded-full" />
              <div className="flex-1">
                <div className="tk-skeleton h-4 w-32" />
                <div className="tk-skeleton mt-2 h-3 w-48 max-w-full" />
              </div>
              <div className="tk-skeleton h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
