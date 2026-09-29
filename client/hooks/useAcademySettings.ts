"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
};

const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  academyName: "DojoFlow Academy",
  tagline: "Train with purpose. Manage with clarity.",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#D7A84B",
  secondaryColor: "#101A33",
  contactEmail: "",
  contactPhone: "",
  website: "",
  address: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

type AcademySettingsResponse = {
  success?: boolean;
  data?: AcademySettings;
  message?: string;
};

export function useAcademySettings() {
  const [settings, setSettings] = useState<AcademySettings>(
    DEFAULT_ACADEMY_SETTINGS,
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token")
          : null;

      const response = await fetch(
        `${API_URL}/settings/academy`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          cache: "no-store",
        },
      );

      const data: AcademySettingsResponse =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to load academy settings.",
        );
      }

      if (data.data) {
        setSettings({
          ...DEFAULT_ACADEMY_SETTINGS,
          ...data.data,
        });
      }
    } catch (err) {
      console.error(
        "Academy settings load error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load academy settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    loading,
    error,
    reload: loadSettings,
  };
}

export {
  DEFAULT_ACADEMY_SETTINGS,
};