"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "@/lib/toast";

function copyWithFallback(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);

  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error("Copy is unavailable"));
}

export default function CopyButton({ value, label = "Value", className = "" }: { value?: string | null; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const text = String(value || "").trim();

  useEffect(() => () => { if (resetTimer.current) window.clearTimeout(resetTimer.current); }, []);

  async function copy() {
    if (!text) return;
    try {
      await copyWithFallback(text);
      setCopied(true);
      toast.success(`${label} copied to clipboard.`, "Copied");
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`, "Copy failed");
    }
  }

  return <button type="button" onClick={() => void copy()} disabled={!text} aria-label={`Copy ${label}`} title={`Copy ${label}`} className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-(--line) text-(--ink-muted) transition-colors hover:bg-(--hover-bg) hover:text-(--foreground) focus:outline-none focus:ring-2 focus:ring-(--accent)/40 disabled:cursor-not-allowed disabled:opacity-40 print:hidden ${className}`}>
    {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
  </button>;
}
