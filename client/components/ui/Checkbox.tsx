import { forwardRef, type InputHTMLAttributes } from "react";

const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Checkbox({ className = "", type = "checkbox", ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        type={type}
        className={`
          h-4 w-4 rounded border-(--line-strong) text-(--accent)
          focus:ring-2 focus:ring-(--accent)/20 disabled:cursor-not-allowed disabled:opacity-60
          ${className}
        `}
      />
    );
  },
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
