"use client";

import Link from "next/link";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Link href="/" className="text-xl font-semibold">
            Taskora
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="tk-page-title">Something went wrong</h1>

        <p className="mt-4 text-sm leading-6 text-zinc-600">
          We couldn&apos;t load this page. This is usually temporary, so try
          again in a moment.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => retry()}
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            Try again
          </button>

          <Link
            href="/dashboard"
            className="tk-btn tk-btn-secondary w-full sm:w-auto"
          >
            Go to dashboard
          </Link>
        </div>

        {/* The digest is an opaque ID that matches the server log entry; the
            error message itself is never shown. */}
        {error.digest && (
          <p className="mt-8 text-xs text-zinc-500">
            Reference: {error.digest}
          </p>
        )}
      </main>
    </div>
  );
}
