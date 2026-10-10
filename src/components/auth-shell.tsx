import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-white text-ink lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="w-fit text-xl font-semibold tracking-tight text-ink"
        >
          Taskora
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16">
          <div>
            <p className="text-sm font-medium text-zinc-500">
              Welcome to Taskora
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {description}
            </p>
          </div>

          <div className="mt-9">{children}</div>

          <div className="mt-8 text-center text-sm text-zinc-600">
            {footer}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          © {new Date().getFullYear()} Everything Digital
        </p>
      </section>

      <section className="relative hidden overflow-hidden bg-zinc-950 text-white lg:block">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-zinc-700" />
          <div className="absolute -right-4 -top-4 h-96 w-96 rounded-full border border-zinc-800" />
          <div className="absolute bottom-24 left-20 h-40 w-40 rounded-full border border-zinc-800" />
        </div>

        <div className="relative flex min-h-screen flex-col justify-between p-12 xl:p-16">
          <div>
            <p className="text-sm font-medium text-zinc-400">
              A product by Everything Digital
            </p>
          </div>

          <div className="max-w-xl">
            <p className="mb-6 text-sm font-medium text-zinc-400">
              ONE WORKSPACE. CLEAR PRIORITIES.
            </p>

            <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Keep the work moving without losing the context.
            </h2>

            <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">
              Plan projects, assign ownership, track progress, and keep your
              team&apos;s conversations connected to the work that matters.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-zinc-800 pt-8">
              <div>
                <p className="text-sm font-medium text-white">Projects</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Organize the work
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-white">Tasks</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Clarify ownership
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-white">Teams</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Stay aligned
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-400">Taskora</p>
        </div>
      </section>
    </main>
  );
}