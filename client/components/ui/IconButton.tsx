"use client";

import {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

type IconButtonVariant =
  | "default"
  | "primary"
  | "danger"
  | "ghost";

type IconButtonSize =
  | "sm"
  | "md"
  | "lg";

type IconButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    label: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
  };

export default function IconButton({
  children,
  label,
  variant = "default",
  size = "md",
  className = "",
  type = "button",
  ...props
}: IconButtonProps) {
  const variants: Record<
    IconButtonVariant,
    string
  > = {
    default: `
      border-(--line)
      bg-(--card)
      text-(--ink-muted)
      hover:bg-(--hover-bg)
      hover:text-(--foreground)
      hover:border-(--line-strong)
    `,

    primary: `
      border-(--primary)
      bg-(--primary)
      text-(--primary-foreground)
      hover:bg-(--primary-hover)
    `,

    danger: `
      border-(--danger)
      bg-(--danger)
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

  const sizes: Record<
    IconButtonSize,
    string
  > = {
    sm: "h-8 w-8 rounded-lg",
    md: "h-10 w-10 rounded-[10px]",
    lg: "h-11 w-11 rounded-[10px]",
  };

  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={label}
      className={`
        inline-flex
        shrink-0
        items-center
        justify-center
        border
        shadow-sm
        transition-all
        duration-200
        active:scale-95
        disabled:cursor-not-allowed
        disabled:opacity-50
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
    >
      {children}
    </button>
  );
}