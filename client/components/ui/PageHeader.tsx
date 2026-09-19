import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={`
        mb-6
        flex
        flex-col
        gap-4
        sm:flex-row
        sm:items-center
        sm:justify-between
        ${className}
      `}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="
              mb-1.5
              text-[10px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-(--accent)
            "
          >
            {eyebrow}
          </p>
        )}

        <h1
          className="
            text-[26px]
            font-extrabold
            tracking-tight
            text-(--foreground)
            sm:text-3xl
          "
        >
          {title}
        </h1>

        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-(--ink-muted)">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}