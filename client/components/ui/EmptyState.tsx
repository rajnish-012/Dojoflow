import { Inbox } from "lucide-react";
import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`
        flex
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        border-dashed
        border-(--line)
        bg-(--card)
        px-6
        py-12
        text-center
        ${className}
      `}
    >
      <div
        className="
          flex
          h-12
          w-12
          items-center
          justify-center
          rounded-xl
          bg-(--hover-bg)
          text-(--ink-muted)
        "
      >
        {icon || <Inbox size={22} />}
      </div>

      <h3 className="mt-4 text-sm font-bold text-(--foreground)">
        {title}
      </h3>

      {description && (
        <p className="mt-1 max-w-md text-xs leading-5 text-(--ink-muted)">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}