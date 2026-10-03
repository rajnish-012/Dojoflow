"use client";


import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

/* =========================================================
   TYPES
========================================================= */

export type WebsiteHero = {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  image?: string;
  mobileImage?: string;
  primaryButtonText?: string;
  primaryButtonUrl?: string;
  secondaryButtonText?: string;
  secondaryButtonUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type WebsiteSection = {
  _id: string;
  key: string;
  title?: string;
  subtitle?: string;
  description?: string;
  content?: string;
  image?: string;
  secondaryImage?: string;
  ctaText?: string;
  ctaUrl?: string;
  highlights?: string[];
  sortOrder?: number;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WebsiteStatistic = {
  _id: string;
  label: string;
  value: string;
  suffix?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WebsiteFeature = {
  _id: string;
  title: string;
  description?: string;
  icon?: string;
  image?: string;
  linkText?: string;
  linkUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type WebsiteHomeData = {
  heroes: WebsiteHero[];
  sections: WebsiteSection[];
  statistics: WebsiteStatistic[];
  features: WebsiteFeature[];
};


/* =========================================================
   API HELPERS
========================================================= */

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
};

function getApiUrl() {
  return API_URL.replace(/\/+$/, "");
}


async function parseResponse<T>(
  response: Response,
): Promise<T> {
  let data: ApiResponse<T> = {};

  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an invalid response.",
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}.`,
    );
  }

  return (
    data.data !== undefined
      ? data.data
      : (data as unknown as T)
  );
}

async function authenticatedFetch(
  path: string,
  options: RequestInit = {},
) {
  const headers = new Headers(
    options.headers,
  );

  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    );
  }

  return fetchWithSession(
    `${getApiUrl()}${path}`,
    {
      ...options,
      headers,
    },
  );
}


/* =========================================================
   HEROES
========================================================= */

export async function getWebsiteHeroes() {
  const response =
    await authenticatedFetch(
      "/website/heroes",
    );

  return parseResponse<WebsiteHero[]>(
    response,
  );
}

export async function createWebsiteHero(
  payload: Omit<
    WebsiteHero,
    "_id" | "createdAt" | "updatedAt"
  >,
) {
  const response =
    await authenticatedFetch(
      "/website/heroes",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteHero>(
    response,
  );
}

export async function updateWebsiteHero(
  id: string,
  payload: Partial<
    Omit<
      WebsiteHero,
      "_id" | "createdAt" | "updatedAt"
    >
  >,
) {
  const response =
    await authenticatedFetch(
      `/website/heroes/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteHero>(
    response,
  );
}

export async function deleteWebsiteHero(
  id: string,
) {
  const response =
    await authenticatedFetch(
      `/website/heroes/${id}`,
      {
        method: "DELETE",
      },
    );

  return parseResponse<{
    message?: string;
  }>(response);
}


/* =========================================================
   SECTIONS
========================================================= */

export async function getWebsiteSections() {
  const response =
    await authenticatedFetch(
      "/website/sections",
    );

  return parseResponse<WebsiteSection[]>(
    response,
  );
}

export async function saveWebsiteSection(
  payload: Omit<
    WebsiteSection,
    "_id" | "createdAt" | "updatedAt"
  > & {
    _id?: string;
  },
) {
  const response =
    await authenticatedFetch(
      "/website/sections",
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteSection>(
    response,
  );
}


/* =========================================================
   STATISTICS
========================================================= */

export async function getWebsiteStatistics() {
  const response =
    await authenticatedFetch(
      "/website/statistics",
    );

  return parseResponse<WebsiteStatistic[]>(
    response,
  );
}

export async function createWebsiteStatistic(
  payload: Omit<
    WebsiteStatistic,
    "_id" | "createdAt" | "updatedAt"
  >,
) {
  const response =
    await authenticatedFetch(
      "/website/statistics",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteStatistic>(
    response,
  );
}

export async function updateWebsiteStatistic(
  id: string,
  payload: Partial<
    Omit<
      WebsiteStatistic,
      "_id" | "createdAt" | "updatedAt"
    >
  >,
) {
  const response =
    await authenticatedFetch(
      `/website/statistics/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteStatistic>(
    response,
  );
}

export async function deleteWebsiteStatistic(
  id: string,
) {
  const response =
    await authenticatedFetch(
      `/website/statistics/${id}`,
      {
        method: "DELETE",
      },
    );

  return parseResponse<{
    message?: string;
  }>(response);
}


/* =========================================================
   FEATURES
========================================================= */

export async function getWebsiteFeatures() {
  const response =
    await authenticatedFetch(
      "/website/features",
    );

  return parseResponse<WebsiteFeature[]>(
    response,
  );
}

export async function createWebsiteFeature(
  payload: Omit<
    WebsiteFeature,
    "_id" | "createdAt" | "updatedAt"
  >,
) {
  const response =
    await authenticatedFetch(
      "/website/features",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteFeature>(
    response,
  );
}

export async function updateWebsiteFeature(
  id: string,
  payload: Partial<
    Omit<
      WebsiteFeature,
      "_id" | "createdAt" | "updatedAt"
    >
  >,
) {
  const response =
    await authenticatedFetch(
      `/website/features/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

  return parseResponse<WebsiteFeature>(
    response,
  );
}

export async function deleteWebsiteFeature(
  id: string,
) {
  const response =
    await authenticatedFetch(
      `/website/features/${id}`,
      {
        method: "DELETE",
      },
    );

  return parseResponse<{
    message?: string;
  }>(response);
}


/* =========================================================
   PUBLIC WEBSITE
========================================================= */

export async function getPublicWebsiteHome() {
  const response = await fetchWithSession(
    `${getApiUrl()}/website/home`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return parseResponse<WebsiteHomeData>(
    response,
  );
}
