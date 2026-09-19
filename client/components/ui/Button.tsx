"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "success"
  | "ghost";

type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  leftIcon,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: `
      border-(--primary)
      bg-(--primary)
      text-(--primary-foreground)
      hover:bg-(--primary-hover)
      hover:border-(--primary-hover)
    `,

    secondary: `
      border-(--accent)
      bg-(--accent)
      text-(--accent-foreground)
      hover:bg-(--accent-hover)
      hover:border-(--accent-hover)
    `,

    outline: `
      border-(--line)
      bg-transparent
      text-(--foreground)
      hover:bg-(--hover-bg)
      hover:border-(--line-strong)
    `,

    danger: `
      border-(--danger)
      bg-(--danger)
      text-white
      hover:opacity-90
    `,
    success: `
      border-(--success)
      bg-(--success)
      text-white
      hover:opacity-90
    `,

    ghost: `
      border-transparent
      bg-transparent
      text-(--ink-muted)
      hover:bg-(--hover-bg)
      hover:text-(--foreground)
    `,
  };

  const sizes: Record<ButtonSize, string> = {
    sm: `
      h-9
      rounded-lg
      px-3
      text-xs
    `,

    md: `
      h-10
      rounded-[10px]
      px-4
      text-[13px]
    `,

    lg: `
      h-11
      rounded-[10px]
      px-5
      text-sm
    `,
  };

  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        border
        font-semibold
        shadow-sm
        transition-all
        duration-200
        active:scale-[0.98]
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="
            h-4
            w-4
            animate-spin
            rounded-full
            border-2
            border-current
            border-t-transparent
          "
        />
      )}
      {!loading && leftIcon}
      {children}
    </button>
  );
}
