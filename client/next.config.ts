import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * NEXT_PUBLIC values are embedded into the browser bundle at build time.
   * Require the API origin for production builds so localhost cannot silently
   * ship as the production API address.
   */
  ...(process.env.NODE_ENV === "production"
    ? (() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL is required for production builds.");
        let parsed: URL;
        try {
          parsed = new URL(apiUrl);
        } catch {
          throw new Error("NEXT_PUBLIC_API_URL must be an absolute HTTP(S) URL.");
        }
        if (!["https:", "http:"].includes(parsed.protocol) || parsed.pathname === "/") {
          throw new Error("NEXT_PUBLIC_API_URL must include the API base path and use HTTP(S).");
        }
        const host = parsed.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
        const localHost = host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0.0.0.0" || /^127(?:\.\d{1,3}){3}$/.test(host);
        const placeholderHost = /(^|\.)(example\.(com|org|net)|invalid|test)$/i.test(host);
        if (parsed.protocol !== "https:" || localHost || placeholderHost) {
          throw new Error("NEXT_PUBLIC_API_URL must use a real HTTPS production hostname.");
        }
        return {};
      })()
    : {}),
};

export default nextConfig;
