export default function WorkspaceLoading() {
  return (
    <div role="status">
      <span className="sr-only">Loading workspace</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-48" />

        <div className="mt-4 flex items-center gap-4">
          <div className="tk-skeleton size-12" />
          <div>
            <div className="tk-skeleton h-7 w-48" />
            <div className="tk-skeleton mt-2 h-4 w-24" />
          </div>
        </div>

        <div className="tk-skeleton mt-10 h-5 w-24" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="tk-card p-5">
              <div className="tk-skeleton h-4 w-36" />
              <div className="tk-skeleton mt-3 h-3 w-full" />
              <div className="tk-skeleton mt-2 h-3 w-2/3" />
              <div className="mt-4 border-t border-line pt-4">
                <div className="tk-skeleton h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
