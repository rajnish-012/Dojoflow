"use client";

import {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import Link from "next/link";

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
    href?: string;
  };

export default function IconButton({
  children,
  label,
  variant = "default",
  size = "md",
  className = "",
  type = "button",
  href,
  title,
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
      bg-(--danger-soft)
      text-(--danger)
      hover:bg-(--danger)
      hover:text-white
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

  const sharedClassName = `
    inline-flex
    shrink-0
    items-center
    justify-center
    border
    transition-all
    duration-200
    active:scale-95
    disabled:cursor-not-allowed
    disabled:opacity-50
    ${variants[variant]}
    ${sizes[size]}
    ${className}
  `;

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        title={title ?? label}
        className={sharedClassName}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={sharedClassName}
    >
      {children}
    </button>
  );
}
