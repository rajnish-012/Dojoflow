const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export type HolidayBranch = {
  _id: string;
  name: string;
  address?: string;
};

export type Holiday = {
  _id: string;
  date: string;
  name: string;
  description?: string;
  branch: HolidayBranch | string | null;
  isActive: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  updatedBy?: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

function getToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("token") || "";
}

async function parseResponse(
  response: Response,
) {
  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `API returned an invalid response (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Holiday request failed.",
    );
  }

  return data;
}

/* ==========================================
   GET HOLIDAYS
========================================== */

export async function getHolidays(
  params?: {
    date?: string;
    from?: string;
    to?: string;
    branch?: string;
    includeInactive?: boolean;
  },
) {
  const token = getToken();

  const searchParams =
    new URLSearchParams();

  if (params?.date) {
    searchParams.set(
      "date",
      params.date,
    );
  }

  if (params?.from) {
    searchParams.set(
      "from",
      params.from,
    );
  }

  if (params?.to) {
    searchParams.set(
      "to",
      params.to,
    );
  }

  if (params?.branch) {
    searchParams.set(
      "branch",
      params.branch,
    );
  }

  if (params?.includeInactive) {
    searchParams.set(
      "includeInactive",
      "true",
    );
  }

  const query =
    searchParams.toString();

  const response = await fetch(
    `${API_URL}/holidays${
      query ? `?${query}` : ""
    }`,
    {
      method: "GET",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse(response);
}

/* ==========================================
   GET HOLIDAY BY DATE
========================================== */

export async function getHolidayByDate(
  date: string,
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/holidays/by-date?date=${encodeURIComponent(
      date,
    )}`,
    {
      method: "GET",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  return parseResponse(response);
}

/* ==========================================
   CREATE HOLIDAY
========================================== */

export async function createHoliday(
  data: {
    date: string;
    name: string;
    description?: string;
    branch?: string | null;
  },
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/holidays`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  return parseResponse(response);
}

/* ==========================================
   UPDATE HOLIDAY
========================================== */

export async function updateHoliday(
  id: string,
  data: {
    date?: string;
    name?: string;
    description?: string;
    branch?: string | null;
    isActive?: boolean;
  },
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/holidays/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    },
  );

  return parseResponse(response);
}

/* ==========================================
   DELETE HOLIDAY
========================================== */

export async function deleteHoliday(
  id: string,
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}/holidays/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type":
          "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    },
  );

  return parseResponse(response);
}