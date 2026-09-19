import {
  HTMLAttributes,
  ReactNode,
} from "react";

type CardPadding =
  | "none"
  | "sm"
  | "md"
  | "lg";

type CardProps =
  HTMLAttributes<HTMLDivElement> & {
    children: ReactNode;
    padding?: CardPadding;
  };

export default function Card({
  children,
  padding = "md",
  className = "",
  ...props
}: CardProps) {
  const paddingClasses: Record<
    CardPadding,
    string
  > = {
    none: "p-0",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      {...props}
      className={`
        rounded-2xl
        border
        border-(--line)
        bg-(--card)
        text-(--foreground)
        shadow-[0_6px_24px_var(--shadow-color)]
        transition-all
        duration-200
        hover:border-(--line-strong)
        ${paddingClasses[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}