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
        rounded-2xl
        border
        border-(--line)
        bg-(--card)
        p-5
        text-(--foreground)
        shadow-[0_6px_24px_var(--shadow-color)]
        transition-all
        duration-300
        ease-(--ease-premium)
        hover:-translate-y-1
        hover:border-(--line-strong)
        hover:shadow-[0_16px_40px_var(--shadow-color)]
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-(--ink-muted)">
            {title}
          </p>

          <p className="mt-2 text-[28px] font-extrabold tracking-tight text-(--foreground)">
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-xs text-(--ink-muted)">
              {subtitle}
            </p>
          )}

          {trend && (
            <p className="mt-2 text-xs font-semibold text-(--accent)">
              {trend}
            </p>
          )}
        </div>

        {icon && (
          <div
            className="
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
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
    </div>
  );
}