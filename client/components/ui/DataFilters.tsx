"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";

import Button from "./Button";

export type ActiveFilter = {
  id: string;
  label: string;
  onClear: () => void;
};

type DataFiltersProps = {
  children: ReactNode;
  activeFilters?: ActiveFilter[];
  onClearAll: () => void;
  label?: string;
  triggerIcon?: ReactNode;
  panelWidth?: number;
  panelClassName?: string;
  contentClassName?: string;
  headerClassName?: string;
  responsiveToolbar?: boolean;
};

/**
 * Presentation-only filter popover. Pages retain ownership of filter state
 * and decide whether that state is resolved locally or by the API.
 */
export default function DataFilters({
  children,
  activeFilters = [],
  onClearAll,
  label = "Filters",
  triggerIcon,
  panelWidth = 352,
  panelClassName = "",
  contentClassName = "grid gap-4 sm:grid-cols-2",
  headerClassName = "mb-4",
  responsiveToolbar = false,
}: DataFiltersProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState({ left: 16, top: 16, width: 352 });
  const activeCount = activeFilters.length;

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const bounds = triggerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const width = Math.min(panelWidth, window.innerWidth - 32);
      const left = Math.max(16, Math.min(bounds.right - width, window.innerWidth - width - 16));

      const top = Math.max(16, Math.min(bounds.bottom + 8, window.innerHeight - 240));

      setPanelPosition({ left, top, width });
    };

    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, panelWidth]);

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${label} options`}
      className={`fixed z-[110] overflow-y-auto rounded-xl border border-(--line) bg-(--card) p-4 shadow-[var(--shadow-md)] ${panelClassName}`}
      style={{
        left: panelPosition.left,
        top: panelPosition.top,
        width: panelPosition.width,
        maxHeight: `calc(100vh - ${panelPosition.top + 16}px)`,
      }}
    >
      <div className={`${headerClassName} flex items-center justify-between gap-4`}>
        <p className="text-sm font-bold text-(--foreground)">{label}</p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-bold text-(--danger) hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <div className={contentClassName}>{children}</div>
    </div>,
    document.body,
  ) : null;

  return (
    <div
      ref={triggerRef}
      className={
        responsiveToolbar
          ? "relative w-full min-w-0 lg:w-auto lg:shrink-0"
          : "relative shrink-0"
      }
    >
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={
          responsiveToolbar
            ? "h-11 min-h-11 w-full whitespace-nowrap px-3 lg:h-10 lg:min-h-0 lg:w-auto lg:px-4"
            : ""
        }
      >
        {triggerIcon ?? <SlidersHorizontal size={16} aria-hidden="true" />}
        {label}{activeCount ? ` (${activeCount})` : ""}
      </Button>
      {panel}

      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
          {activeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={filter.onClear}
              className="inline-flex items-center gap-1 rounded-full border border-(--line) bg-(--surface) px-2.5 py-1 text-xs font-semibold text-(--foreground-soft) hover:border-(--line-strong) hover:bg-(--hover-bg)"
              aria-label={`Remove ${filter.label} filter`}
            >
              {filter.label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
