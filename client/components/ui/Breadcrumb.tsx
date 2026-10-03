import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const visibleItems = items.filter((item) => item.label.trim());

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 max-w-full">
      <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden text-sm">
        {visibleItems.map((item, index) => {
          const current = index === visibleItems.length - 1;
          return (
            <li key={`${item.label}-${index}`} className={`${current ? "flex" : "hidden sm:flex"} min-w-0 shrink-0 items-center gap-1.5 last:min-w-0 last:shrink`}>
              {index > 0 && (
                <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-(--ink-faint)" />
              )}
              {current ? (
                <span aria-current="page" className="truncate font-semibold text-(--foreground)">
                  {item.label}
                </span>
              ) : item.href ? (
                <Link href={item.href} className="truncate text-(--ink-muted) transition-colors hover:text-(--foreground)">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-(--ink-muted)">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
