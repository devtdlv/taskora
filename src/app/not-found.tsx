import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <SiteHeader />

      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-sm font-medium text-zinc-500">404</p>

        <h1 className="tk-page-title mt-3">Page not found</h1>

        <p className="mt-4 text-sm leading-6 text-zinc-600">
          This page doesn&apos;t exist, or you don&apos;t have access to it. If
          someone shared a link with you, check that you&apos;re signed in with
          the right account.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="tk-btn tk-btn-primary w-full sm:w-auto"
          >
            Go to dashboard
          </Link>

          <Link
            href="/"
            className="tk-btn tk-btn-secondary w-full sm:w-auto"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
