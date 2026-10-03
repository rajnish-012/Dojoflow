import { forwardRef, type TextareaHTMLAttributes } from "react";

const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...props }, ref) {
    return (
      <textarea
        ref={ref}
        {...props}
        className={`
          min-h-24 w-full resize-y rounded-xl border border-(--line) bg-(--input)
          px-3.5 py-3 text-sm font-medium text-(--foreground) outline-none transition-all duration-200
          placeholder:text-(--ink-faint) hover:border-(--line-strong)
          focus:border-(--accent) focus:bg-(--card) focus:ring-4 focus:ring-(--accent)/10
          disabled:cursor-not-allowed disabled:bg-(--surface) disabled:opacity-60
          ${className}
        `}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
