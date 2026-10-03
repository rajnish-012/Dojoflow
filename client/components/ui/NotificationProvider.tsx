"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import ConfirmationDialog from "./ConfirmationDialog";
import { CONFIRM_EVENT_NAME, TOAST_EVENT_NAME, type ConfirmationRequest, type ToastPayload } from "@/lib/toast";

const styles = {
  success: { Icon: CheckCircle2, className: "border-(--success)/25 bg-(--card) text-(--success)" },
  error: { Icon: AlertCircle, className: "border-(--danger)/25 bg-(--card) text-(--danger)" },
  warning: { Icon: TriangleAlert, className: "border-(--warning)/25 bg-(--card) text-(--warning)" },
  info: { Icon: Info, className: "border-(--info)/25 bg-(--card) text-(--info)" },
};

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastPayload[]>([]);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  useEffect(() => {
    const onToast = (event: Event) => {
      const item = (event as CustomEvent<ToastPayload>).detail;
      setItems((current) => [...current.slice(-3), item]);
      window.setTimeout(() => setItems((current) => current.filter((toast) => toast.id !== item.id)), item.duration ?? 5000);
    };
    window.addEventListener(TOAST_EVENT_NAME, onToast);
    const onConfirm = (event: Event) => {
      const request = (event as CustomEvent<ConfirmationRequest>).detail;
      setConfirmation((current) => {
        current?.resolve(false);
        return request;
      });
    };
    window.addEventListener(CONFIRM_EVENT_NAME, onConfirm);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast);
      window.removeEventListener(CONFIRM_EVENT_NAME, onConfirm);
    };
  }, []);

  return <>
    {children}
    <div className="pointer-events-none fixed right-3 top-3 z-[300] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5" aria-live="polite" aria-relevant="additions text">
      {items.map((item) => {
        const { Icon, className } = styles[item.kind];
        return <div key={item.id} role={item.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-(--foreground) ${className}`}>
          <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title}</p>{item.message && <p className="mt-0.5 break-words text-sm text-(--ink-muted)">{item.message}</p>}</div>
          <button type="button" onClick={() => setItems((current) => current.filter((toast) => toast.id !== item.id))} className="rounded-md p-1 text-(--ink-muted) hover:bg-(--hover-bg)" aria-label="Dismiss notification"><X size={16} /></button>
        </div>;
      })}
    </div>
    <ConfirmationDialog
      open={Boolean(confirmation)}
      title={confirmation?.title || "Confirm action"}
      description={confirmation?.message || "Are you sure you want to continue?"}
      confirmLabel={confirmation?.confirmLabel || "Continue"}
      confirmVariant={confirmation?.destructive ? "danger" : "primary"}
      onClose={() => { confirmation?.resolve(false); setConfirmation(null); }}
      onConfirm={() => { confirmation?.resolve(true); setConfirmation(null); }}
    />
  </>;
}
