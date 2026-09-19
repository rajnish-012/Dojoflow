type LoadingSpinnerProps = {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullPage?: boolean;
};

export default function LoadingSpinner({
  size = "md",
  text,
  fullPage = false,
}: LoadingSpinnerProps) {
  const sizes: Record<
    "sm" | "md" | "lg",
    string
  > = {
    sm: "h-4 w-4 border-2",
    md: "h-7 w-7 border-2",
    lg: "h-10 w-10 border-[3px]",
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        role="status"
        aria-label="Loading"
        className={`
          animate-spin
          rounded-full
          border-(--line)
          border-t-(--accent)
          ${sizes[size]}
        `}
      />

      {text && (
        <p className="text-xs font-medium text-(--ink-muted)">
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}