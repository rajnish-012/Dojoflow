/** Credentialed API fetch. Auth is supplied only by the HttpOnly session cookie. */
export async function fetchWithSession(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  // Defense in depth: old callers may still construct Bearer headers while migrating.
  headers.delete("Authorization");
  const response = await fetch(input, { ...init, headers, credentials: "include" });
  const url = input instanceof Request ? input.url : String(input);
  const shouldExpireSession = response.status === 401 &&
    !/\/auth\/(login|logout|me|migrate-legacy-session)(?:\?|$)/.test(url);
  if (shouldExpireSession && typeof window !== "undefined") {
    window.dispatchEvent(new Event("forcestrike:session-expired"));
  }
  return response;
}
