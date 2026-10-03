import { type ReactNode } from "react";

type TableHeadingProps = {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
};

export default function TableHeading({ children, align = "left", className = "" }: TableHeadingProps) {
  return (
    <th
      scope="col"
      className={`px-6 py-4 text-xs font-bold uppercase tracking-[0.14em] text-(--ink-faint) ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}
