import {
  forwardRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type InputProps =
  InputHTMLAttributes<HTMLInputElement> & {
    leftIcon?: ReactNode;
  };

const Input = forwardRef(function Input(
  {
    className = "",
    type = "text",
    leftIcon,
    ...props
  }: InputProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const field = (
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

        ${leftIcon ? "pl-10" : ""}
        ${className}
      `}
    />
  );

  if (!leftIcon) return field;

  return (
    <div className="relative w-full">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-faint)">
        {leftIcon}
      </span>

      {field}
    </div>
  );
});

Input.displayName = "Input";

export default Input;