"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

import type { WorkspaceRole } from "@/generated/prisma/enums";
import { getInitials } from "@/lib/initials";

type NavWorkspace = {
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export function AppNav({ workspace }: { workspace?: NavWorkspace }) {
  const pathname = usePathname();
  const workspaceHref = workspace ? `/workspaces/${workspace.slug}` : null;

  // "page" marks the exact page; "true" marks the section a nested page
  // belongs to, such as Projects while a board or task is open.
  let projectsCurrent: "page" | "true" | undefined;
  if (pathname === workspaceHref) {
    projectsCurrent = "page";
  } else if (pathname.startsWith(`${workspaceHref}/projects/`)) {
    projectsCurrent = "true";
  }

  return (
    <nav aria-label="Main">
      <ul className="space-y-1">
        <li>
          <Link
            href="/dashboard"
            aria-current={pathname === "/dashboard" ? "page" : undefined}
            className="tk-nav-link"
          >
            Dashboard
          </Link>
        </li>
        <li>
          <Link
            href="/settings"
            aria-current={pathname === "/settings" ? "page" : undefined}
            className="tk-nav-link"
          >
            Settings
          </Link>
        </li>
      </ul>

      {workspace && workspaceHref && (
        <div className="mt-8">
          <p className="px-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">
            Workspace
          </p>

          <div className="mt-3 flex items-center gap-3 px-3">
            <span aria-hidden="true" className="tk-avatar size-8 text-xs">
              {getInitials(workspace.name)}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {workspace.name}
              </p>
              <p className="text-xs text-zinc-500">
                {workspace.role === "OWNER" ? "Owner" : "Member"}
              </p>
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            <li>
              <Link
                href={workspaceHref}
                aria-current={projectsCurrent}
                className="tk-nav-link"
              >
                Projects
              </Link>
            </li>
            <li>
              <Link
                href={`${workspaceHref}/members`}
                aria-current={
                  pathname === `${workspaceHref}/members` ? "page" : undefined
                }
                className="tk-nav-link"
              >
                Members
              </Link>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}

export function MobileMenu({ children }: { children: React.ReactNode }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Client-side navigation keeps this component mounted, so the menu is
  // closed explicitly once a link inside it is followed.
  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) {
      detailsRef.current?.removeAttribute("open");
    }
  }

  return (
    <details ref={detailsRef} className="group">
      <summary className="tk-btn tk-btn-secondary tk-btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Menu</span>
        <span className="hidden group-open:inline">Close</span>
      </summary>

      <div
        onClick={handleClick}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-line bg-surface px-4 py-5 shadow-sm"
      >
        {children}
      </div>
    </details>
  );
}
