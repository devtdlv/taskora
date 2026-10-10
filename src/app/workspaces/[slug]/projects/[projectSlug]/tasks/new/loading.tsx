export default function NewTaskLoading() {
  return (
    <div role="status" className="max-w-2xl">
      <span className="sr-only">Loading</span>

      <div aria-hidden="true">
        <div className="tk-skeleton h-4 w-72 max-w-full" />

        <div className="tk-card mt-4 p-5 sm:p-8">
          <div className="tk-skeleton h-7 w-40" />
          <div className="tk-skeleton mt-3 h-4 w-full" />

          <div className="mt-8 space-y-5">
            <div className="tk-skeleton h-10 w-full" />
            <div className="tk-skeleton h-28 w-full" />
            <div className="tk-skeleton h-10 w-full" />
            <div className="tk-skeleton h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
