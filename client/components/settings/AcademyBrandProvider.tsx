"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

import type { CSSProperties } from "react";

/* =========================================================
   TYPES
========================================================= */

export type AcademySettings = {
  _id?: string;

  academyName: string;
  tagline: string;

  logoUrl: string;
  faviconUrl: string;

  primaryColor: string;
  secondaryColor: string;

  contactEmail: string;
  contactPhone: string;

  website: string;
  address: string;

  timezone: string;
  currency: string;

  updatedAt?: string;
  createdAt?: string;
};

type AcademyBrandContextValue = {
  settings: AcademySettings;

  loading: boolean;
  initialized: boolean;

  reload: () => Promise<void>;
};

/* =========================================================
   EMPTY SETTINGS
========================================================= */

/*
 * IMPORTANT:
 *
 * Do NOT put academy-specific default values here.
 *
 * The Header, Sidebar and other components must display
 * the latest values saved in MongoDB.
 *
 * Empty values are used only while there is no saved
 * academy settings document.
 */

const EMPTY_SETTINGS: AcademySettings = {
  academyName: "",
  tagline: "",

  logoUrl: "",
  faviconUrl: "",

  primaryColor: "",
  secondaryColor: "",

  contactEmail: "",
  contactPhone: "",

  website: "",
  address: "",

  timezone: "",
  currency: "",
};

/* =========================================================
   API
========================================================= */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const NORMALIZED_API_URL = API_URL.replace(/\/+$/, "");

/* =========================================================
   CONTEXT
========================================================= */

const AcademyBrandContext = createContext<AcademyBrandContextValue | null>(
  null,
);

/* =========================================================
   HELPERS
========================================================= */

function normalizeSettings(value: unknown): AcademySettings {
  if (!value || typeof value !== "object") {
    return {
      ...EMPTY_SETTINGS,
    };
  }

  const record = value as Partial<AcademySettings>;

  return {
    ...EMPTY_SETTINGS,

    _id: typeof record._id === "string" ? record._id : undefined,

    academyName:
      typeof record.academyName === "string" ? record.academyName : "",

    tagline: typeof record.tagline === "string" ? record.tagline : "",

    logoUrl: typeof record.logoUrl === "string" ? record.logoUrl : "",

    faviconUrl: typeof record.faviconUrl === "string" ? record.faviconUrl : "",

    primaryColor:
      typeof record.primaryColor === "string" ? record.primaryColor : "",

    secondaryColor:
      typeof record.secondaryColor === "string" ? record.secondaryColor : "",

    contactEmail:
      typeof record.contactEmail === "string" ? record.contactEmail : "",

    contactPhone:
      typeof record.contactPhone === "string" ? record.contactPhone : "",

    website: typeof record.website === "string" ? record.website : "",

    address: typeof record.address === "string" ? record.address : "",

    timezone: typeof record.timezone === "string" ? record.timezone : "",

    currency: typeof record.currency === "string" ? record.currency : "",

    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,

    createdAt:
      typeof record.createdAt === "string" ? record.createdAt : undefined,
  };
}

function addVersionParam(url: string, version: string) {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const source = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}academyBrand=${encodeURIComponent(version)}${hash}`;
}

/*
 * Supports all response shapes currently used
 * by the academy settings API.
 *
 * Preferred backend response:
 *
 * {
 *   success: true,
 *   settings: {...}
 * }
 *
 * Also supports:
 *
 * {
 *   data: {...}
 * }
 *
 * and:
 *
 * {
 *   data: {
 *     settings: {...}
 *   }
 * }
 */

function extractSettings(payload: any): AcademySettings {
  const candidate =
    payload?.settings ??
    payload?.data?.settings ??
    payload?.data ??
    payload?.academySettings ??
    null;

  return normalizeSettings(candidate);
}

/* =========================================================
   PROVIDER
========================================================= */

export default function AcademyBrandProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<AcademySettings>(EMPTY_SETTINGS);

  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  /* =======================================================
     LOAD SETTINGS
  ======================================================= */

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);

      let response: Response | null = null;
      let networkError: unknown;

      // The API can start slightly after the client during local/dev
      // startup. Retry only fetch/network failures; HTTP errors should be
      // surfaced immediately and won't benefit from another request.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await fetch(
            `${NORMALIZED_API_URL}/settings/academy/public`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
              cache: "no-store",
            },
          );
          break;
        } catch (error) {
          networkError = error;
          if (attempt < 2) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, 400 * (attempt + 1)),
            );
          }
        }
      }

      if (!response) {
        throw networkError instanceof Error
          ? networkError
          : new Error("Academy settings API is unreachable.");
      }

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Failed to load academy settings.");
      }

      const latestSettings = extractSettings(payload);

      setSettings(latestSettings);
    } catch (error) {
      console.warn(
        `Academy branding could not be refreshed from ${NORMALIZED_API_URL}. The last successfully loaded branding will remain in use.`,
        error instanceof Error ? error.message : error,
      );

      // Never substitute hardcoded academy data. On first load the context
      // stays empty; on refresh, the last successfully loaded values remain.
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  /* Keep browser metadata aligned if Next.js rewrites the document head on navigation. */
  useEffect(() => {
    const academyName = settings.academyName.trim() || "Academy Portal";
    const faviconUrl = settings.faviconUrl.trim();
    const logoUrl = settings.logoUrl.trim();
    const safeFaviconUrl = /^(https?:\/\/|\/)/i.test(faviconUrl)
      ? faviconUrl
      : "";
    const safeLogoUrl = /^(https?:\/\/|\/)/i.test(logoUrl) ? logoUrl : "";
    const initials = academyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase())
      .join("")
      .replace(/[^\p{L}\p{N}]/gu, "") || "A";
    const fallbackIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#e44498"/><text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="#fff">${initials}</text></svg>`;
    const fallbackIconUrl = `data:image/svg+xml,${encodeURIComponent(fallbackIconSvg)}`;
    const configuredIconUrl = safeFaviconUrl || safeLogoUrl;
    const iconSource = configuredIconUrl || fallbackIconUrl;
    const iconUrl =
      settings.updatedAt &&
      configuredIconUrl?.startsWith("/") &&
      !configuredIconUrl.startsWith("//")
        ? addVersionParam(configuredIconUrl, settings.updatedAt)
      : iconSource;

    const syncBrandMetadata = () => {
      if (document.title !== academyName) {
        document.title = academyName;
      }

      let iconLinks = document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      );

      if (iconLinks.length === 0) {
        const iconLink = document.createElement("link");
        iconLink.rel = "icon";
        iconLink.id = "academy-dynamic-favicon";
        document.head.appendChild(iconLink);
        iconLinks = document.querySelectorAll<HTMLLinkElement>(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
        );
      }

      iconLinks.forEach((link) => {
        if (link.href !== new URL(iconUrl, window.location.href).href) {
          link.href = iconUrl;
        }
      });
    };

    syncBrandMetadata();
    const headObserver = new MutationObserver(syncBrandMetadata);
    headObserver.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "rel"],
    });

    return () => headObserver.disconnect();
  }, [pathname, settings.academyName, settings.faviconUrl, settings.logoUrl, settings.updatedAt]);

  /* =======================================================
     RELOAD
  ======================================================= */

  const reload = useCallback(async () => {
    await loadSettings();
  }, [loadSettings]);

  /* =======================================================
     BRAND CSS VARIABLES
  ======================================================= */

  const brandStyle = useMemo(() => {
    const style: CSSProperties & {
      "--academy-primary"?: string;
      "--academy-secondary"?: string;
      "--gold"?: string;
      "--accent"?: string;
      "--secondary"?: string;
    } = {};

    /*
     * Only apply saved colors.
     *
     * No hardcoded academy colors are injected.
     */
    if (settings.primaryColor.trim()) {
      style["--academy-primary"] = settings.primaryColor;

      /*
       * Existing application components
       * already use --gold and --accent.
       *
       * Connect them to the saved academy
       * primary color.
       */
      style["--gold"] = settings.primaryColor;

      style["--accent"] = settings.primaryColor;
    }

    if (settings.secondaryColor.trim()) {
      style["--academy-secondary"] = settings.secondaryColor;

      style["--secondary"] = settings.secondaryColor;
    }

    return style;
  }, [settings.primaryColor, settings.secondaryColor]);

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const contextValue = useMemo(
    () => ({
      settings,
      loading,
      initialized,
      reload,
    }),
    [settings, loading, initialized, reload],
  );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AcademyBrandContext.Provider value={contextValue}>
      <div style={brandStyle} className="contents">
        {children}
      </div>
    </AcademyBrandContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useAcademyBrand() {
  const context = useContext(AcademyBrandContext);

  if (!context) {
    throw new Error(
      "useAcademyBrand must be used inside AcademyBrandProvider.",
    );
  }

  return context;
}

export function AcademyLogo({
  className = "h-full w-full rounded-md object-contain",
}: {
  className?: string;
}) {
  const { settings } = useAcademyBrand();
  const [failedLogoUrl, setFailedLogoUrl] = useState("");
  const academyName = settings.academyName.trim() || "Your Academy";
  const initials = academyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  if (settings.logoUrl.trim() && failedLogoUrl !== settings.logoUrl) {
    return (
      <Image
        src={settings.logoUrl}
        alt={`${academyName} logo`}
        width={256}
        height={256}
        unoptimized
        className={className}
        onError={() => setFailedLogoUrl(settings.logoUrl)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${academyName} logo`}
      className={`flex items-center justify-center font-extrabold ${className}`}
    >
      {initials || "A"}
    </span>
  );
}
