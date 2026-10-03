import { HTMLAttributes, ReactNode } from "react";

type CardPadding = "none" | "sm" | "md" | "lg";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: CardPadding;
  /** Lifts the card a little when the mouse is over it. */
  hoverable?: boolean;
};

export default function Card({
  children,
  padding = "md",
  hoverable = false,
  className = "",
  ...props
}: CardProps) {
  const paddingClasses: Record<CardPadding, string> = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  const hoverClasses = hoverable
    ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-sm)]"
    : "";

  return (
    <div
      {...props}
      className={`
        rounded-2xl
        border
        border-(--line)
        bg-(--card)
        text-(--foreground)
        shadow-none
        transition-all
        duration-300
        ease-(--ease-premium)
        hover:border-(--line-strong)
        ${hoverClasses}
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
