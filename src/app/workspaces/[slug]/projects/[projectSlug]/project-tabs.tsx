import Link from "next/link";

type ProjectTabsProps = {
  projectHref: string;
  current: "board" | "analytics";
};

export function ProjectTabs({ projectHref, current }: ProjectTabsProps) {
  const tabs = [
    { id: "board", label: "Board", href: projectHref },
    { id: "analytics", label: "Analytics", href: `${projectHref}/analytics` },
  ] as const;

  return (
    <nav aria-label="Project" className="mt-6 border-b border-line pb-2">
      <ul className="flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={tab.id === current ? "page" : undefined}
              className="tk-nav-link"
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
