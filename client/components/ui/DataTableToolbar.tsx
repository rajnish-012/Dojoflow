import type { ReactNode } from "react";

type DataTableToolbarProps = {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Shared responsive layout for list search, filter, sort, and action controls. */
export default function DataTableToolbar({
  children,
  actions,
  className = "",
}: DataTableToolbarProps) {
  return (
    <div
      className={`
        data-table-toolbar
        grid w-full min-w-0 grid-cols-2 items-center gap-2
        lg:flex lg:w-auto lg:flex-nowrap lg:items-start
        [&>*]:min-w-0
        [&>[data-toolbar-search]]:col-span-full
        [&>[data-toolbar-search]]:w-full
        [&>[data-toolbar-search]]:min-w-0
        ${className}
      `}
    >
      {children}
      {actions && (
        <div className="col-span-full flex min-w-0 flex-wrap items-center gap-2 lg:ml-1 lg:w-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
