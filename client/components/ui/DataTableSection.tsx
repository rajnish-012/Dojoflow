import type { ReactNode } from "react";
import Card from "./Card";

type DataTableSectionProps = {
  title: string;
  description: string;
  icon: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
};

/** Shared card, heading, and toolbar shell for standard management tables. */
export default function DataTableSection({
  title,
  description,
  icon,
  toolbar,
  children,
  className = "",
  headerClassName = "",
}: DataTableSectionProps) {
  return (
    <Card padding="none" className={`overflow-hidden ${className}`}>
      <div
        className={`flex flex-col justify-between gap-5 border-b border-(--line) px-5 py-5 sm:px-6 lg:flex-row lg:items-center ${headerClassName}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-(--foreground)">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-(--ink-muted) sm:text-sm">
              {description}
            </p>
          </div>
        </div>
        {toolbar && (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {toolbar}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}
