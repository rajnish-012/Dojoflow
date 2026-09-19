"use client";

import {
  ReactNode,
  useEffect,
} from "react";

import { X } from "lucide-react";

import IconButton from "./IconButton";

type ModalSize =
  | "sm"
  | "md"
  | "lg"
  | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
};

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed inset-0 z-[100]
        flex items-center justify-center
        overflow-y-auto
        bg-[rgba(7,12,24,0.58)]
        p-4
        sm:p-6
        dark:bg-[rgba(0,0,0,0.68)]
      "
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`
          flex
          w-full
          ${sizes[size]}
          max-h-[calc(100vh-32px)]
          flex-col
          overflow-hidden
          rounded-2xl
          border
          border-(--line)
          bg-(--card)
          text-(--foreground)
          shadow-[0_30px_90px_rgba(0,0,0,0.28)]
          animate-[df-modal-in_220ms_ease-out]
          sm:max-h-[calc(100vh-48px)]
          dark:shadow-[0_30px_90px_rgba(0,0,0,0.55)]
        `}
      >
        {/* MODAL HEADER */}
        <div
          className="
            flex
            shrink-0
            items-start
            justify-between
            gap-5
            border-b
            border-(--line)
            bg-(--card)
            px-5
            py-4
            sm:px-6
            sm:py-5
          "
        >
          <div className="min-w-0">
            <p
              className="
                mb-1
                text-[10px]
                font-black
                uppercase
                tracking-[0.18em]
                text-(--accent)
              "
            >
              New admission
            </p>

            <h2
              id="modal-title"
              className="
                text-xl
                font-extrabold
                tracking-tight
                text-(--foreground)
                sm:text-2xl
              "
            >
              {title}
            </h2>

            {description && (
              <p
                className="
                  mt-1.5
                  max-w-xl
                  text-xs
                  leading-5
                  text-(--ink-muted)
                  sm:text-sm
                "
              >
                {description}
              </p>
            )}
          </div>

          <IconButton
            label="Close"
            size="md"
            variant="ghost"
            onClick={onClose}
            className="
              border
              border-(--line)
              bg-(--surface)
              text-(--ink-muted)
              hover:border-(--line-strong)
              hover:bg-(--hover-bg)
              hover:text-(--foreground)
            "
          >
            <X
              size={18}
              strokeWidth={2}
            />
          </IconButton>
        </div>

        {/* MODAL CONTENT */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            bg-(--card)
            p-5
            sm:p-6
          "
        >
          {children}
        </div>

        {/* MODAL FOOTER */}
        {footer && (
          <div
            className="
              flex
              shrink-0
              flex-col-reverse
              gap-2.5
              border-t
              border-(--line)
              bg-(--surface)
              px-5
              py-4
              sm:flex-row
              sm:justify-end
              sm:px-6
            "
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}