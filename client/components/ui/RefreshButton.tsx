"use client";

import { RefreshCw } from "lucide-react";
import IconButton from "./IconButton";

type RefreshButtonProps = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function RefreshButton({
  onClick,
  loading = false,
  label = "Refresh",
  size = "md",
  className = "",
}: RefreshButtonProps) {
  return (
    <IconButton
      label={loading ? "Refreshing" : label}
      onClick={onClick}
      disabled={loading}
      size={size}
      className={className}
    >
      <RefreshCw
        size={17}
        strokeWidth={2}
        className={loading ? "animate-spin" : ""}
      />
    </IconButton>
  );
}