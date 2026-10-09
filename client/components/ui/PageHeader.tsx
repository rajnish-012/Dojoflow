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
        min-w-0
        flex-col
        gap-4
        lg:flex-row
        lg:items-center
        lg:justify-between
        ${className}
      `}
    >
      <div className="w-full min-w-0 lg:flex-1">
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
            break-words
            text-(--foreground)
            lg:text-3xl
          "
        >
          {title}
        </h1>

        {description && (
          <p className="mt-1.5 w-full min-w-0 text-sm text-(--ink-muted) lg:max-w-2xl">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 [&>*]:min-w-0 [&>*]:max-w-full lg:w-auto lg:shrink-0 lg:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
