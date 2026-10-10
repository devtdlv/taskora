import Link from "next/link";

import { getCurrentUser } from "@/lib/session";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-xl font-semibold">
          Taskora
        </Link>

        {user ? (
          <nav aria-label="Account" className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Dashboard
            </Link>

            <form action="/api/auth/logout" method="post">
              <button type="submit" className="tk-btn tk-btn-secondary">
                Log out
              </button>
            </form>
          </nav>
        ) : (
          <nav aria-label="Account" className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900"
            >
              Log in
            </Link>

            <Link href="/signup" className="tk-btn tk-btn-primary">
              Get started
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
