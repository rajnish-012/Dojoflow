export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof Error) {
    if (error.name === "TypeError" && /fetch|network/i.test(error.message)) return "Unable to connect to the server. Check your connection and try again.";
    const message = error.message.trim();
    if (message && !/\bat\s+.+\(.+:\d+:\d+\)/.test(message) && !message.includes("\n    at ")) return message;
  }
  if (error && typeof error === "object") {
    const value = error as { response?: { data?: { message?: unknown; error?: unknown; errors?: unknown } }; message?: unknown; errors?: unknown };
    const body = value.response?.data;
    for (const candidate of [body?.message, body?.error, value.message]) if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    const errors = body?.errors ?? value.errors;
    if (Array.isArray(errors)) {
      const messages = errors.map((item) => typeof item === "string" ? item : item && typeof item === "object" && "message" in item ? String((item as { message: unknown }).message) : "").filter(Boolean);
      if (messages.length) return messages.join(" ");
    }
  }
  return fallback;
}
