"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

/* =========================================================
   CONTEXT
========================================================= */

const AcademyBrandContext =
  createContext<AcademyBrandContextValue | null>(
    null,
  );

/* =========================================================
   HELPERS
========================================================= */

function normalizeSettings(
  value: unknown,
): AcademySettings {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return {
      ...EMPTY_SETTINGS,
    };
  }

  const record =
    value as Partial<AcademySettings>;

  return {
    ...EMPTY_SETTINGS,

    _id:
      typeof record._id === "string"
        ? record._id
        : undefined,

    academyName:
      typeof record.academyName ===
      "string"
        ? record.academyName
        : "",

    tagline:
      typeof record.tagline ===
      "string"
        ? record.tagline
        : "",

    logoUrl:
      typeof record.logoUrl ===
      "string"
        ? record.logoUrl
        : "",

    faviconUrl:
      typeof record.faviconUrl ===
      "string"
        ? record.faviconUrl
        : "",

    primaryColor:
      typeof record.primaryColor ===
      "string"
        ? record.primaryColor
        : "",

    secondaryColor:
      typeof record.secondaryColor ===
      "string"
        ? record.secondaryColor
        : "",

    contactEmail:
      typeof record.contactEmail ===
      "string"
        ? record.contactEmail
        : "",

    contactPhone:
      typeof record.contactPhone ===
      "string"
        ? record.contactPhone
        : "",

    website:
      typeof record.website ===
      "string"
        ? record.website
        : "",

    address:
      typeof record.address ===
      "string"
        ? record.address
        : "",

    timezone:
      typeof record.timezone ===
      "string"
        ? record.timezone
        : "",

    currency:
      typeof record.currency ===
      "string"
        ? record.currency
        : "",

    updatedAt:
      typeof record.updatedAt ===
      "string"
        ? record.updatedAt
        : undefined,

    createdAt:
      typeof record.createdAt ===
      "string"
        ? record.createdAt
        : undefined,
  };
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

function extractSettings(
  payload: any,
): AcademySettings {
  const candidate =
    payload?.settings ??
    payload?.data?.settings ??
    payload?.data ??
    payload?.academySettings ??
    null;

  return normalizeSettings(
    candidate,
  );
}

/* =========================================================
   PROVIDER
========================================================= */

export default function AcademyBrandProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    settings,
    setSettings,
  ] = useState<AcademySettings>(
    EMPTY_SETTINGS,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* =======================================================
     LOAD SETTINGS
  ======================================================= */

  const loadSettings =
    useCallback(async () => {
      try {
        setLoading(true);

        const response =
          await fetch(
            `${API_URL}/settings/academy/public`,
            {
              method: "GET",

              headers: {
                "Content-Type":
                  "application/json",
              },

              cache: "no-store",
            },
          );

        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.message ||
              "Failed to load academy settings.",
          );
        }

        const latestSettings =
          extractSettings(
            payload,
          );

        setSettings(
          latestSettings,
        );
      } catch (error) {
        console.error(
          "Academy brand loading error:",
          error,
        );

        /*
         * Do not replace the failed API response
         * with hardcoded academy information.
         *
         * Keep the context empty.
         */
        setSettings({
          ...EMPTY_SETTINGS,
        });
      } finally {
        setLoading(false);
      }
    }, []);

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  /* =======================================================
     RELOAD
  ======================================================= */

  const reload =
    useCallback(async () => {
      await loadSettings();
    }, [loadSettings]);

  /* =======================================================
     BRAND CSS VARIABLES
  ======================================================= */

  const brandStyle =
    useMemo(() => {
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
      if (
        settings.primaryColor.trim()
      ) {
        style[
          "--academy-primary"
        ] =
          settings.primaryColor;

        /*
         * Existing application components
         * already use --gold and --accent.
         *
         * Connect them to the saved academy
         * primary color.
         */
        style["--gold"] =
          settings.primaryColor;

        style["--accent"] =
          settings.primaryColor;
      }

      if (
        settings.secondaryColor.trim()
      ) {
        style[
          "--academy-secondary"
        ] =
          settings.secondaryColor;

        style["--secondary"] =
          settings.secondaryColor;
      }

      return style;
    }, [
      settings.primaryColor,
      settings.secondaryColor,
    ]);

  /* =======================================================
     CONTEXT VALUE
  ======================================================= */

  const contextValue =
    useMemo(
      () => ({
        settings,
        loading,
        reload,
      }),
      [
        settings,
        loading,
        reload,
      ],
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AcademyBrandContext.Provider
      value={contextValue}
    >
      <div
        style={brandStyle}
        className="contents"
      >
        {children}
      </div>
    </AcademyBrandContext.Provider>
  );
}

/* =========================================================
   HOOK
========================================================= */

export function useAcademyBrand() {
  const context =
    useContext(
      AcademyBrandContext,
    );

  if (!context) {
    throw new Error(
      "useAcademyBrand must be used inside AcademyBrandProvider.",
    );
  }

  return context;
}
