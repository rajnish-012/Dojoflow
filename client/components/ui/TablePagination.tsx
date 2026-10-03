"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import Button from "./Button";
import Select from "./Select";

type TablePaginationProps = {
  currentPage?: number;
  totalPages?: number;
  totalItems: number;
  visibleItems: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  entityLabel?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export default function TablePagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  visibleItems,
  pageSize,
  pageSizeOptions = [25, 50, 100],
  entityLabel = "items",
  onPrevious,
  onNext,
  onPageSizeChange,
}: TablePaginationProps) {
  const hasItems = totalItems > 0 && visibleItems > 0;

  const start =
    hasItems && pageSize
      ? (currentPage - 1) * pageSize + 1
      : hasItems
        ? 1
        : 0;

  const end =
    hasItems && pageSize
      ? Math.min(
          start + visibleItems - 1,
          totalItems,
        )
      : visibleItems;

  const hasPagination =
    totalPages > 1 &&
    Boolean(onPrevious) &&
    Boolean(onNext);

  return (
    <div
      className="
        flex flex-col gap-3
        border-t border-(--line)
        px-5 py-4
        sm:flex-row
        sm:items-center
        sm:justify-between
        sm:px-6
      "
    >
      <p
        className="
          text-xs font-medium
          text-(--ink-faint)
        "
      >
        {hasItems ? (
          <>
            Showing{" "}
            <strong className="text-(--foreground-soft)">
              {start}–{end}
            </strong>{" "}
            of{" "}
            <strong className="text-(--foreground-soft)">
              {totalItems}
            </strong>{" "}
            {entityLabel}
          </>
        ) : (
          <>Showing 0 of 0 {entityLabel}</>
        )}
      </p>

      {(hasPagination || onPageSizeChange) && (
        <div className="flex flex-wrap items-center gap-2">
          {onPageSizeChange && pageSize && (
            <label className="flex items-center gap-2 text-xs font-semibold text-(--ink-muted)">
              <span className="hidden sm:inline">Page size</span>
              <Select
                className="h-9 w-20 px-2 text-xs"
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                aria-label={`Rows per page for ${entityLabel}`}
              >
                {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </label>
          )}
          {hasPagination && <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={onPrevious}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
            <span className="hidden sm:inline">
              Previous
            </span>
          </Button>

          <span
            className="
              whitespace-nowrap
              text-xs font-semibold
              text-(--ink-muted)
            "
          >
            Page {currentPage} of {totalPages}
          </span>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={onNext}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">
              Next
            </span>
            <ChevronRight size={15} />
          </Button>
          </>}
        </div>
      )}
    </div>
  );
}
