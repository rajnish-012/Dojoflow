import {
  InputHTMLAttributes,
  forwardRef,
} from "react";

const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input(
  {
    className = "",
    type = "text",
    ...props
  },
  ref,
) {
  return (
    <input
      ref={ref}
      {...props}
      type={type}
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

        placeholder:text-(--ink-faint)

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
    />
  );
});

Input.displayName = "Input";

export default Input;