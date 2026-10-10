import Link from "next/link";

type Crumb = {
  label: string;
  href?: string;
};

// The last item is the current page and is rendered without a link.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600">
        {items.map((item, index) => (
          <li key={index} className="flex min-w-0 items-center gap-2">
            {index > 0 && (
              <span aria-hidden="true" className="text-zinc-400">
                /
              </span>
            )}

            {item.href ? (
              <Link
                href={item.href}
                className="max-w-[14rem] truncate rounded-sm hover:text-ink"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="max-w-[16rem] truncate font-medium text-ink"
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
