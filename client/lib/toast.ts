export type ToastKind = "success" | "error" | "warning" | "info";
export type ToastPayload = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  duration?: number;
};
export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
};
export type ConfirmationRequest = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

const EVENT_NAME = "forcestrike:toast";
const CONFIRM_EVENT = "forcestrike:confirm";
function publish(
  kind: ToastKind,
  message: string,
  title?: string,
  duration?: number,
) {
  if (typeof window === "undefined") return;
  const text = String(message || "").trim();
  if (!text) return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(EVENT_NAME, {
      detail: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        kind,
        title: title || kind[0].toUpperCase() + kind.slice(1),
        message: text,
        duration,
      },
    }),
  );
}

export const toast = {
  success: (message: string, title?: string) =>
    publish("success", message, title),
  error: (message: string, title?: string) =>
    publish("error", message, title, 7000),
  warning: (message: string, title?: string) =>
    publish("warning", message, title),
  info: (message: string, title?: string) => publish("info", message, title),
};

export const TOAST_EVENT_NAME = EVENT_NAME;
export const CONFIRM_EVENT_NAME = CONFIRM_EVENT;
export function confirmAction(options: ConfirmationOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent<ConfirmationRequest>(CONFIRM_EVENT, {
        detail: { ...options, resolve },
      }),
    ),
  );
}
