import { AlertCircle } from "lucide-react";
import { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
};

export default function ErrorState({
  title = "Something went wrong",
  message,
  action,
  className = "",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`
        flex
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        border-(--line)
        bg-(--card)
        px-6
        py-10
        text-center
        ${className}
      `}
    >
      <div
        className="
          flex
          h-11
          w-11
          items-center
          justify-center
          rounded-xl
          bg-(--danger-soft)
          text-(--danger)
        "
      >
        <AlertCircle
          size={21}
          strokeWidth={2}
        />
      </div>

      <h3 className="mt-4 text-sm font-bold text-(--foreground)">
        {title}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-5 text-(--ink-muted)">
        {message}
      </p>

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}