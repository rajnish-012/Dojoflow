"use client";

import { fetchWithSession } from "@/lib/sessionFetch";
import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { Button, Card, Input, Select } from "@/components/ui";
import InternationalPhoneInput, {
  isValidPhoneNumber,
} from "@/components/ui/InternationalPhoneInput";
import { toast } from "@/lib/toast";

import { useAcademyBrand } from "./AcademyBrandProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type AcademySettings = {
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
};

const TIMEZONE_OPTIONS = [
  {
    value: "Asia/Kolkata",
    label: "India — Asia/Kolkata",
  },
  {
    value: "Asia/Dubai",
    label: "Dubai — Asia/Dubai",
  },
  {
    value: "Asia/Singapore",
    label: "Singapore — Asia/Singapore",
  },
  {
    value: "Europe/London",
    label: "London — Europe/London",
  },
  {
    value: "America/New_York",
    label: "New York — America/New_York",
  },
  {
    value: "America/Los_Angeles",
    label: "Los Angeles — America/Los_Angeles",
  },
];

const CURRENCY_OPTIONS = [
  {
    value: "INR",
    label: "Indian Rupee (INR)",
  },
  {
    value: "USD",
    label: "US Dollar (USD)",
  },
  {
    value: "EUR",
    label: "Euro (EUR)",
  },
  {
    value: "GBP",
    label: "British Pound (GBP)",
  },
  {
    value: "AED",
    label: "UAE Dirham (AED)",
  },
  {
    value: "SGD",
    label: "Singapore Dollar (SGD)",
  },
];

function createEmptySettings(): AcademySettings {
  return {
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
}

function normalizeSettings(
  value?: Partial<AcademySettings> | null,
): AcademySettings {
  const empty = createEmptySettings();

  return {
    ...empty,
    ...(value || {}),
  };
}

function isValidHex(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function formatUpdatedAt(value?: string) {
  if (!value) {
    return "Not saved yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="
          flex h-11 w-11 shrink-0 items-center
          justify-center rounded-2xl
          border border-(--line)
          bg-(--surface-muted)
          text-(--gold)
        "
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p
          className="
            text-[10px] font-black uppercase
            tracking-[0.16em] text-(--gold)
          "
        >
          {eyebrow}
        </p>

        <h3
          className="
            mt-1 text-base font-black
            tracking-tight text-(--foreground)
          "
        >
          {title}
        </h3>

        <p
          className="
            mt-1 max-w-2xl text-xs leading-5
            text-(--ink-muted)
          "
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          className="
            text-xs font-bold
            text-(--foreground-soft)
          "
        >
          {label}
        </label>

        {hint && <span className="text-[10px] text-(--ink-faint)">{hint}</span>}
      </div>

      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const validColor = isValidHex(value);

  return (
    <Field label={label} hint={validColor ? value : "Not configured"}>
      <div className="flex gap-3">
        <div
          className="
            relative flex h-11 w-14 shrink-0
            items-center justify-center
            overflow-hidden rounded-xl
            border border-(--line)
            bg-(--surface-muted)
          "
        >
          {validColor ? (
            <div
              className="absolute inset-1 rounded-lg"
              style={{
                backgroundColor: value,
              }}
            />
          ) : (
            <Palette size={17} className="text-(--ink-faint)" />
          )}

          <input
            type="color"
            value={validColor ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className="
              absolute inset-0 h-full w-full
              cursor-pointer opacity-0
            "
            aria-label={label}
          />
        </div>

        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter hex color"
        />
      </div>
    </Field>
  );
}

function LogoPreview({ settings }: { settings: AcademySettings }) {
  const initials = settings.academyName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasLogo = Boolean(settings.logoUrl.trim());

  return (
    <div
      className="
        relative overflow-hidden rounded-3xl
        border border-(--line)
        bg-(--surface-muted)
      "
    >
      <div
        className="
          absolute inset-x-0 top-0 h-24
          opacity-80
        "
        style={{
          background: isValidHex(settings.secondaryColor)
            ? `linear-gradient(135deg, ${settings.secondaryColor}, transparent)`
            : undefined,
        }}
      />

      <div className="relative p-6">
        <div
          className="
            mb-5 flex items-center justify-between
            gap-3
          "
        >
          <div>
            <p
              className="
                text-[10px] font-black uppercase
                tracking-[0.16em] text-(--ink-faint)
              "
            >
              Live Preview
            </p>

            <p className="mt-1 text-xs text-(--ink-muted)">
              Based on the current form values
            </p>
          </div>

          <div
            className="
              rounded-full border border-(--line)
              bg-(--card) px-2.5 py-1
              text-[10px] font-bold
              text-(--ink-muted)
            "
          >
            Preview
          </div>
        </div>

        <div
          className="
            flex min-h-48 flex-col
            items-center justify-center
            rounded-2xl border border-(--line)
            bg-(--card)/80 p-6 text-center
          "
        >
          {hasLogo ? (
            <img
              src={settings.logoUrl}
              alt={settings.academyName || "Academy logo"}
              className="
                max-h-24 max-w-full
                object-contain
              "
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div
              className="
                flex h-16 w-16 items-center
                justify-center rounded-2xl
                border border-(--line)
                bg-(--surface-muted)
                text-lg font-black
                text-(--ink-muted)
              "
            >
              {initials || "—"}
            </div>
          )}

          <h4
            className="
              mt-5 text-base font-black
              text-(--foreground)
            "
          >
            {settings.academyName || "Academy name not configured"}
          </h4>

          <p
            className="
              mt-1 max-w-xs text-xs
              leading-5 text-(--ink-muted)
            "
          >
            {settings.tagline || "No academy tagline configured"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AcademyBranding() {
  const { reload } = useAcademyBrand();

  const [settings, setSettings] = useState<AcademySettings>(
    createEmptySettings(),
  );

  const [lastSavedSettings, setLastSavedSettings] =
    useState<AcademySettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const hasDatabaseSettings = useMemo(
    () => Boolean(lastSavedSettings?._id),
    [lastSavedSettings],
  );

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const response = await fetchWithSession(`${API_URL}/settings/academy`, {
        method: "GET",
        headers: {},
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load academy settings.");
      }

      const databaseSettings = data.settings ?? data.data ?? null;

      if (databaseSettings) {
        const normalized = normalizeSettings(databaseSettings);

        setSettings(normalized);
        setLastSavedSettings(normalized);
      } else {
        /*
         * No database document exists.
         * Do NOT show application defaults.
         */
        const empty = createEmptySettings();

        setSettings(empty);
        setLastSavedSettings(null);
      }
    } catch (caughtError) {
      console.error("Load academy settings error:", caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load academy settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function updateField(field: keyof AcademySettings, value: string) {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function handleReset() {
    if (lastSavedSettings) {
      setSettings({
        ...lastSavedSettings,
      });
    } else {
      setSettings(createEmptySettings());
    }

    setError("");
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      if (!settings.academyName.trim()) {
        setError("Academy name is required.");
        setSaving(false);
        return;
      }

      if (
        settings.contactPhone.trim() &&
        !isValidPhoneNumber(settings.contactPhone, "IN")
      ) {
        setError("Enter a valid contact phone number with its country code.");
        setSaving(false);
        return;
      }

      const response = await fetchWithSession(`${API_URL}/settings/academy`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          academyName: settings.academyName.trim(),

          tagline: settings.tagline.trim(),

          logoUrl: settings.logoUrl.trim(),

          faviconUrl: settings.faviconUrl.trim(),

          primaryColor: settings.primaryColor.trim(),

          secondaryColor: settings.secondaryColor.trim(),

          contactEmail: settings.contactEmail.trim(),

          contactPhone: settings.contactPhone.trim(),

          website: settings.website.trim(),

          address: settings.address.trim(),

          timezone: settings.timezone.trim(),

          currency: settings.currency.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Failed to update academy settings.",
        );
      }

      const savedSettings = data.settings ?? data.data ?? null;

      if (!savedSettings) {
        throw new Error(
          "The server did not return the saved academy settings.",
        );
      }

      const normalized = normalizeSettings(savedSettings);

      setSettings(normalized);
      setLastSavedSettings(normalized);

      await reload();

      toast.success("Academy settings saved successfully.");
    } catch (caughtError) {
      console.error("Save academy settings error:", caughtError);
      toast.error(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to update academy settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <div
          className="
            flex min-h-64 items-center
            justify-center
          "
        >
          <div className="text-center">
            <div
              className="
                mx-auto mb-4 flex h-12 w-12
                items-center justify-center
                rounded-2xl border
                border-(--line)
                bg-(--surface-muted)
                text-(--gold)
              "
            >
              <Building2 size={20} />
            </div>

            <p
              className="
                text-sm font-bold
                text-(--foreground)
              "
            >
              Loading academy settings
            </p>

            <p
              className="
                mt-1 text-xs
                text-(--ink-muted)
              "
            >
              Reading the latest saved data...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="
            rounded-2xl border
            border-(--danger)/20
            bg-(--danger-soft)
            px-4 py-3
            text-sm font-semibold
            text-(--danger)
          "
        >
          {error}
        </div>
      )}

      <Card padding="none">
        <div
          className="
            relative overflow-hidden
            rounded-2xl
            border border-(--line)
          "
        >
          <div
            className="
              absolute inset-0 opacity-50
            "
            style={{
              background:
                isValidHex(settings.primaryColor) &&
                isValidHex(settings.secondaryColor)
                  ? `radial-gradient(circle at top right, ${settings.primaryColor}22, transparent 45%), radial-gradient(circle at bottom left, ${settings.secondaryColor}22, transparent 45%)`
                  : undefined,
            }}
          />

          <div
            className="
              relative flex flex-col
              gap-5 p-6
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            <div className="flex items-center gap-4">
              <div
                className="
                  flex h-14 w-14 shrink-0
                  items-center justify-center
                  overflow-hidden rounded-2xl
                  border border-(--line)
                  bg-(--surface-muted)
                "
              >
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.academyName || "Academy"}
                    className="
                      h-full w-full object-contain
                      p-2
                    "
                  />
                ) : (
                  <Building2 size={23} className="text-(--ink-faint)" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className="
                      truncate text-lg font-black
                      text-(--foreground)
                    "
                  >
                    {settings.academyName || "Academy not configured"}
                  </h3>

                  {hasDatabaseSettings && (
                    <span
                      className="
                        inline-flex items-center gap-1.5
                        rounded-full
                        border border-(--success)/20
                        bg-(--success-soft)
                        px-2.5 py-1
                        text-[10px] font-bold
                        text-(--success)
                      "
                    >
                      <ShieldCheck size={12} />
                      Saved
                    </span>
                  )}
                </div>

                <p
                  className="
                    mt-1 text-xs
                    text-(--ink-muted)
                  "
                >
                  {settings.tagline || "No tagline configured"}
                </p>
              </div>
            </div>

            <div
              className="
                flex flex-wrap items-center
                gap-2 text-xs
              "
            >
              <span
                className="
                  rounded-xl border
                  border-(--line)
                  bg-(--surface-muted)
                  px-3 py-2
                  text-(--ink-muted)
                "
              >
                Last saved:{" "}
                <strong className="text-(--foreground)">
                  {formatUpdatedAt(lastSavedSettings?.updatedAt)}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={<Building2 size={19} />}
          eyebrow="Identity"
          title="Academy Identity"
          description="Set the name and public-facing identity that should appear throughout DojoFlow."
        />

        <div
          className="
            mt-6 grid gap-5
            lg:grid-cols-2
          "
        >
          <Field label="Academy Name">
            <Input
              value={settings.academyName}
              onChange={(event) =>
                updateField("academyName", event.target.value)
              }
              placeholder="Enter academy name"
            />
          </Field>

          <Field label="Tagline">
            <Input
              value={settings.tagline}
              onChange={(event) => updateField("tagline", event.target.value)}
              placeholder="Enter academy tagline"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={<ImageIcon size={19} />}
          eyebrow="Visual Identity"
          title="Logo & Favicon"
          description="Control the visual assets used by the academy interface."
        />

        <div
          className="
            mt-6 grid gap-6
            xl:grid-cols-[1fr_360px]
          "
        >
          <div className="space-y-5">
            <Field label="Logo URL" hint="Optional">
              <Input
                value={settings.logoUrl}
                onChange={(event) => updateField("logoUrl", event.target.value)}
                placeholder="Enter logo URL"
              />
            </Field>

            <Field label="Favicon URL" hint="Optional">
              <Input
                value={settings.faviconUrl}
                onChange={(event) =>
                  updateField("faviconUrl", event.target.value)
                }
                placeholder="Enter favicon URL"
              />
            </Field>

            {settings.website && (
              <a
                href={settings.website}
                target="_blank"
                rel="noreferrer"
                className="
                  inline-flex items-center
                  gap-2 text-xs font-bold
                  text-(--accent)
                  hover:underline
                "
              >
                Visit academy website
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          <LogoPreview settings={settings} />
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={<Palette size={19} />}
          eyebrow="Brand System"
          title="Brand Colors"
          description="Define the primary and secondary colors used by your academy branding."
        />

        <div
          className="
            mt-6 grid gap-5
            lg:grid-cols-2
          "
        >
          <ColorField
            label="Primary Color"
            value={settings.primaryColor}
            onChange={(value) => updateField("primaryColor", value)}
          />

          <ColorField
            label="Secondary Color"
            value={settings.secondaryColor}
            onChange={(value) => updateField("secondaryColor", value)}
          />
        </div>

        <div
          className="
            mt-6 grid gap-3
            sm:grid-cols-2
          "
        >
          <div
            className="
              overflow-hidden rounded-2xl
              border border-(--line)
              bg-(--surface-muted)
            "
          >
            <div
              className="h-16"
              style={{
                backgroundColor: isValidHex(settings.primaryColor)
                  ? settings.primaryColor
                  : undefined,
              }}
            />

            <div className="p-4">
              <p
                className="
                  text-xs font-black
                  text-(--foreground)
                "
              >
                Primary
              </p>

              <p
                className="
                  mt-1 text-[11px]
                  text-(--ink-muted)
                "
              >
                {settings.primaryColor || "Not configured"}
              </p>
            </div>
          </div>

          <div
            className="
              overflow-hidden rounded-2xl
              border border-(--line)
              bg-(--surface-muted)
            "
          >
            <div
              className="h-16"
              style={{
                backgroundColor: isValidHex(settings.secondaryColor)
                  ? settings.secondaryColor
                  : undefined,
              }}
            />

            <div className="p-4">
              <p
                className="
                  text-xs font-black
                  text-(--foreground)
                "
              >
                Secondary
              </p>

              <p
                className="
                  mt-1 text-[11px]
                  text-(--ink-muted)
                "
              >
                {settings.secondaryColor || "Not configured"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={<Mail size={19} />}
          eyebrow="Communication"
          title="Contact Information"
          description="Store the academy contact details that can be reused throughout the platform."
        />

        <div
          className="
            mt-6 grid gap-5
            lg:grid-cols-2
          "
        >
          <Field label="Contact Email">
            <div className="relative">
              <Mail
                size={16}
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                type="email"
                value={settings.contactEmail}
                onChange={(event) =>
                  updateField("contactEmail", event.target.value)
                }
                placeholder="Enter contact email"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Contact Phone">
            <InternationalPhoneInput
              id="academy-contact-phone"
              value={settings.contactPhone}
              onChange={(phone) => updateField("contactPhone", phone)}
            />
          </Field>

          <Field label="Website">
            <div className="relative">
              <Globe
                size={16}
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                value={settings.website}
                onChange={(event) => updateField("website", event.target.value)}
                placeholder="Enter academy website"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Address">
            <div className="relative">
              <MapPin
                size={16}
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                value={settings.address}
                onChange={(event) => updateField("address", event.target.value)}
                placeholder="Enter academy address"
                className="pl-9"
              />
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader
          icon={<Globe size={19} />}
          eyebrow="Regional Preferences"
          title="Timezone & Currency"
          description="Use the saved academy configuration for regional display and future financial features."
        />

        <div
          className="
            mt-6 grid gap-5
            lg:grid-cols-2
          "
        >
          <Field label="Timezone">
            <Select
              value={settings.timezone}
              onChange={(event) => updateField("timezone", event.target.value)}
            >
              <option value="">Not configured</option>

              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Currency">
            <Select
              value={settings.currency}
              onChange={(event) => updateField("currency", event.target.value)}
            >
              <option value="">Not configured</option>

              {CURRENCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div
        className="
          sticky bottom-4 z-20
          rounded-2xl border
          border-(--line)
          bg-(--card)/95
          p-3 shadow-xl
          backdrop-blur-xl
        "
      >
        <div
          className="
            flex flex-col gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex h-9 w-9 items-center
                justify-center rounded-xl
                bg-(--surface-muted)
                text-(--gold)
              "
            >
              <Save size={16} />
            </div>

            <div>
              <p
                className="
                  text-xs font-bold
                  text-(--foreground)
                "
              >
                Academy configuration
              </p>

              <p
                className="
                  text-[10px]
                  text-(--ink-muted)
                "
              >
                {hasDatabaseSettings
                  ? "Changes are saved to your academy database."
                  : "No saved academy configuration exists yet."}
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={saving}
            >
              <RotateCcw size={16} />
              Reset Changes
            </Button>

            <Button
              type="button"
              variant="primary"
              loading={saving}
              onClick={handleSave}
            >
              <Save size={16} />
              Save Academy Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
