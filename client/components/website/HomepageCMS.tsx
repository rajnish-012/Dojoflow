"use client";

import {
  useState,
} from "react";

import {
  ExternalLink,
  LayoutDashboard,
  Layers3,
  BarChart3,
  Sparkles,
  RefreshCw,
} from "lucide-react";

import HeroManager from "./HeroManager";
import StatisticsManager from "./StatisticsManager";
import FeaturesManager from "./FeaturesManager";
import SectionsManager from "./SectionsManager";
import { PERMISSIONS, useCan } from "@/lib/permissions";


type CMSSection =
  | "overview"
  | "hero"
  | "statistics"
  | "features"
  | "sections";


const tabs: {
  id: CMSSection;
  label: string;
  description: string;
  icon: typeof LayoutDashboard;
}[] = [
  {
    id: "overview",
    label: "Overview",
    description:
      "Homepage content overview",
    icon: LayoutDashboard,
  },
  {
    id: "hero",
    label: "Hero",
    description:
      "Hero slides and CTAs",
    icon: Sparkles,
  },
  {
    id: "statistics",
    label: "Statistics",
    description:
      "Homepage numbers",
    icon: BarChart3,
  },
  {
    id: "features",
    label: "Features",
    description:
      "Benefits and highlights",
    icon: Sparkles,
  },
  {
    id: "sections",
    label: "Sections",
    description:
      "Homepage content blocks",
    icon: Layers3,
  },
];


export default function HomepageCMS() {
  const canViewWebsite = useCan(PERMISSIONS.WEBSITE_VIEW);
  const [activeSection, setActiveSection] =
    useState<CMSSection>("overview");

  const websiteUrl =
    process.env.NEXT_PUBLIC_WEBSITE_URL ||
    "https://www.theforcestrike.com/";

  if (!canViewWebsite) {
    return (
      <div className="rounded-2xl border border-(--line) bg-(--card) p-6 text-sm text-(--ink-muted)">
        Your role does not have permission to view website content.
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="overflow-hidden rounded-3xl border border-(--line) bg-(--card) shadow-sm">
        <div className="relative overflow-hidden p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-(--accent-soft) blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--background) px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-(--accent)">
                <Sparkles size={12} />
                Website CMS
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-(--foreground) sm:text-4xl">
                Homepage
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ink-muted) sm:text-base">
                Control the content visitors see
                on the ForceStrike website
                directly from the admin panel.
              </p>
            </div>

            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-(--line) bg-(--background) px-4 text-sm font-bold text-(--foreground) transition hover:border-(--line-strong) hover:bg-(--hover-bg)"
            >
              <ExternalLink size={16} />
              View Website
            </a>
          </div>
        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <div className="border-t border-(--line) bg-(--background)/50 p-2">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active =
                activeSection === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(
                      tab.id,
                    )
                  }
                  className={[
                    "flex min-w-fit items-center gap-2 rounded-xl px-3 py-2.5 text-left transition",
                    active
                      ? "bg-(--card) text-(--foreground) shadow-sm"
                      : "text-(--ink-muted) hover:bg-(--card) hover:text-(--foreground)",
                  ].join(" ")}
                >
                  <Icon size={16} />

                  <span className="text-xs font-bold sm:text-sm">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>


      {/* =================================================
          OVERVIEW
      ================================================= */}

      {activeSection ===
        "overview" && (
        <Overview
          onSelect={setActiveSection}
          websiteUrl={websiteUrl}
        />
      )}


      {/* =================================================
          MANAGERS
      ================================================= */}

      {activeSection === "hero" && (
        <HeroManager />
      )}

      {activeSection ===
        "statistics" && (
        <StatisticsManager />
      )}

      {activeSection ===
        "features" && (
        <FeaturesManager />
      )}

      {activeSection ===
        "sections" && (
        <SectionsManager />
      )}
    </div>
  );
}


/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
  onSelect,
  websiteUrl,
}: {
  onSelect: (
    section: CMSSection,
  ) => void;
  websiteUrl: string;
}) {
  const cards = [
    {
      id: "hero" as const,
      title: "Hero",
      description:
        "Manage hero slides, imagery and calls to action.",
      icon: Sparkles,
    },
    {
      id: "statistics" as const,
      title: "Statistics",
      description:
        "Manage the numbers and metrics shown on the homepage.",
      icon: BarChart3,
    },
    {
      id: "features" as const,
      title: "Features",
      description:
        "Manage benefits, features and homepage highlights.",
      icon: Sparkles,
    },
    {
      id: "sections" as const,
      title: "Sections",
      description:
        "Manage the main content blocks and their ordering.",
      icon: Layers3,
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() =>
                onSelect(card.id)
              }
              className="group rounded-2xl border border-(--line) bg-(--card) p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-(--line-strong) hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                <Icon size={19} />
              </div>

              <h2 className="mt-5 font-black">
                {card.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-(--ink-muted)">
                {card.description}
              </p>

              <span className="mt-4 inline-flex text-xs font-bold text-(--accent)">
                Manage →
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-(--line) bg-(--card) shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
              Publishing workflow
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Manage → Publish → Preview
            </h2>

            <p className="mt-3 max-w-xl text-sm leading-6 text-(--ink-muted)">
              Homepage content is stored in
              MongoDB and controlled from this
              CMS. Only active heroes,
              statistics and features, and
              published sections are exposed
              through the public website API.
            </p>

            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-(--accent) px-4 py-2.5 text-sm font-bold text-(--accent-contrast)"
            >
              <ExternalLink size={15} />
              Preview ForceStrike
            </a>
          </div>

          <div className="border-t border-(--line) bg-(--background) p-6 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <Step
                number="01"
                title="Edit"
                text="Update your homepage content."
              />

              <Step
                number="02"
                title="Publish"
                text="Activate the content you want visitors to see."
              />

              <Step
                number="03"
                title="Preview"
                text="Open the live ForceStrike website."
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--accent-soft) text-[10px] font-black text-(--accent)">
        {number}
      </div>

      <div>
        <p className="text-sm font-black">
          {title}
        </p>

        <p className="mt-0.5 text-xs leading-5 text-(--ink-muted)">
          {text}
        </p>
      </div>
    </div>
  );
}
