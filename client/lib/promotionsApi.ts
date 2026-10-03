import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/* ======================================================
   TYPES
====================================================== */

export interface PromotionStudent {
  _id: string;
  name: string;
  age?: number;
  phone?: string;
  email?: string;
  currentBelt?: string;
}

export interface PromotionBranch {
  _id: string;
  name: string;
  address?: string;
}

export interface PromotionPlan {
  _id: string;
  name: string;
}

export interface PromotionProgram {
  _id: string;
  name: string;
}

export interface PromotionMilestone {
  day: number;
  belt: string;
  skill?: string;
  description?: string;
}

export interface EligiblePromotion {
  student: PromotionStudent;
  branch: PromotionBranch;
  plan: PromotionPlan;
  program: PromotionProgram;
  trainingDay: number;
  milestone: PromotionMilestone;
}

export interface BeltHistory {
  _id: string;
  student: string | PromotionStudent;
  branch: string | PromotionBranch;
  plan: string | PromotionPlan;
  sessionTypeId?: string | PromotionProgram | null;
  fromBelt: string;
  toBelt: string;
  milestoneDay: number;
  skill?: string;
  description?: string;
  promotedAt: string;
  approvedBy?: {
    _id: string;
    name: string;
    email?: string;
    role?: string;
  };

  createdAt?: string;
  updatedAt?: string;
}

/* ======================================================
   AUTH
====================================================== */

/**
 * Build authenticated request headers.
 *
 * The server session cookie is only an authentication credential.
 *
 * Permissions are resolved by the backend from the
 * current database role. No frontend/localStorage
 * permission value is sent as an authorization source.
 */
function getAuthHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",

  };
}

/**
 * Handle a JSON API response consistently.
 */
async function parseResponse<T>(response: Response): Promise<T> {
  let data: unknown = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
    }

    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (
        data as {
          message?: unknown;
        }
      ).message === "string"
        ? (
            data as {
              message: string;
            }
          ).message
        : "Request failed";

    throw new Error(message);
  }

  return data as T;
}

/* ======================================================
   GET ELIGIBLE PROMOTIONS
   GET /api/promotions/eligible
====================================================== */

export async function getEligiblePromotions(): Promise<{
  success: boolean;
  count: number;
  eligible: EligiblePromotion[];
}> {
  const response = await fetchWithSession(`${API_URL}/promotions/eligible`, {
    method: "GET",
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  return parseResponse<{
    success: boolean;
    count: number;
    eligible: EligiblePromotion[];
  }>(response);
}

/* ======================================================
   PROMOTE STUDENT
   POST /api/promotions
====================================================== */

export async function promoteStudent(studentId: string, programId: string): Promise<{
  success: boolean;
  message: string;
  promotion: BeltHistory;
}> {
  const response = await fetchWithSession(`${API_URL}/promotions`, {
    method: "POST",
    headers: getAuthHeaders(),

    body: JSON.stringify({
      student: studentId,
      programId,
    }),
  });

  return parseResponse<{
    success: boolean;
    message: string;
    promotion: BeltHistory;
  }>(response);
}

/* ======================================================
   GET BELT HISTORY
   GET /api/promotions/history/:studentId
====================================================== */

export async function getStudentBeltHistory(studentId: string): Promise<{
  success: boolean;

  student: {
    _id: string;
    name: string;
    currentBelt: string;
    branch?: PromotionBranch;
    plan?: PromotionPlan;
  };

  history: BeltHistory[];
}> {
  const response = await fetchWithSession(`${API_URL}/promotions/history/${studentId}`, {
    method: "GET",
    headers: getAuthHeaders(),
    cache: "no-store",
  });

  return parseResponse<{
    success: boolean;

    student: {
      _id: string;
      name: string;
      currentBelt: string;
      branch?: PromotionBranch;
      plan?: PromotionPlan;
    };

    history: BeltHistory[];
  }>(response);
}
