import Link from "next/link";

import type { WorkspaceRole } from "@/generated/prisma/enums";
import { getInitials } from "@/lib/initials";

import { AppNav, MobileMenu } from "./app-nav";

type AppShellProps = {
  user: {
    name: string;
    email: string;
  };
  workspace?: {
    name: string;
    slug: string;
    role: WorkspaceRole;
  };
  children: React.ReactNode;
};

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-md text-base font-semibold text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="7" fill="#18181b" />
        <path
          d="M9.5 10.5h13M16 10.5v12"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="23" cy="22.5" r="2.5" fill="#6366f1" />
      </svg>
      Taskora
    </Link>
  );
}

function Account({ user }: Pick<AppShellProps, "user">) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700"
        >
          {getInitials(user.name)}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
        </div>
      </div>

      <form action="/api/auth/logout" method="post" className="mt-3">
        <button type="submit" className="tk-btn tk-btn-secondary w-full">
          Log out
        </button>
      </form>
    </div>
  );
}

export function AppShell({ user, workspace, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-app">
      <a
        href="#content"
        className="sr-only rounded-md bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-line px-6">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <AppNav workspace={workspace} />
        </div>

        <div className="border-t border-line p-4">
          <Account user={user} />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
        <div className="relative flex h-14 items-center justify-between px-4 sm:px-6">
          <Brand />

          <MobileMenu>
            <AppNav workspace={workspace} />

            <div className="mt-6 border-t border-line pt-5">
              <Account user={user} />
            </div>
          </MobileMenu>
        </div>
      </header>

      <div className="lg:pl-64">
        <main
          id="content"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
