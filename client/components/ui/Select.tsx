import {
  SelectHTMLAttributes,
  forwardRef,
} from "react";

const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select(
  {
    className = "",
    children,
    ...props
  },
  ref,
) {
  return (
    <select
      ref={ref}
      {...props}
      className={`
        h-11
        w-full
        rounded-xl
        border
        border-(--line)
        bg-(--input)
        px-3.5
        text-sm
        font-medium
        text-(--foreground)
        outline-none
        transition-all
        duration-200

        hover:border-(--line-strong)

        focus:border-(--accent)
        focus:bg-(--card)
        focus:ring-4
        focus:ring-(--accent)/10

        disabled:cursor-not-allowed
        disabled:opacity-60
        disabled:bg-(--surface)

        ${className}
      `}
    >
      {children}
    </select>
  );
});

Select.displayName = "Select";

export default Select;