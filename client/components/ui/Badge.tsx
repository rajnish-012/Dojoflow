import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export default function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const variants: Record<
    BadgeVariant,
    string
  > = {
    default: `
      bg-(--hover-bg)
      text-(--ink-muted)
      border
      border-(--line)
    `,

    success: `
      bg-(--success-soft)
      text-(--success)
    `,

    warning: `
      bg-(--warning-soft)
      text-(--warning)
    `,

    danger: `
      bg-(--danger-soft)
      text-(--danger)
    `,

    info: `
      bg-(--info-soft)
      text-(--info)
    `,
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        justify-center
        rounded-full
        px-2.5
        py-1
        text-[10px]
        font-bold
        leading-none
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}