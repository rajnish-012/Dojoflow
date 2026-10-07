import { ReactNode } from "react";

type SummaryCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  icon?: ReactNode;
  className?: string;
};

export default function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className = "",
}: SummaryCardProps) {
  return (
    <div
      className={`
        group
        rounded-xl
        border
        border-(--line)
        bg-(--card)
        p-6
        text-(--foreground)
        shadow-none
        transition-all
        duration-300
        ease-(--ease-premium)
        hover:-translate-y-0.5
        hover:border-(--line-strong)
        hover:shadow-[var(--shadow-sm)]
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-sm font-medium text-(--ink-muted)">
          {title}
        </p>
        {icon && (
          <div
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-(--accent-soft)
              text-(--accent)
              transition-transform
              duration-300
              ease-(--ease-premium)
              group-hover:scale-110
            "
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-1 break-words text-2xl font-bold tracking-tight text-(--foreground) 2xl:text-2xl">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-(--ink-muted)">
          {subtitle}
        </p>
      )}
      {trend && (
        <p className="mt-2 text-sm font-semibold text-(--accent)">
          {trend}
        </p>
      )}
    </div>
  );
}
