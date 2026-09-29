const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

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
  trainingDay: number;
  milestone: PromotionMilestone;
}

export interface BeltHistory {
  _id: string;

  student:
    | string
    | PromotionStudent;

  branch:
    | string
    | PromotionBranch;

  plan:
    | string
    | PromotionPlan;

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

function getToken() {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  return localStorage.getItem(
    "token",
  );
}

/* ======================================================
   GET ELIGIBLE PROMOTIONS
====================================================== */

export async function getEligiblePromotions() {
  const token = getToken();

  const response =
    await fetch(
      `${API_URL}/promotions/eligible`,
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

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to fetch eligible promotions",
    );
  }

  return data as {
    success: boolean;
    count: number;
    eligible: EligiblePromotion[];
  };
}

/* ======================================================
   PROMOTE STUDENT
====================================================== */

export async function promoteStudent(
  studentId: string,
) {
  const token = getToken();

  const response =
    await fetch(
      `${API_URL}/promotions`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          student: studentId,
        }),
      },
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to promote student",
    );
  }

  return data as {
    success: boolean;
    message: string;
    promotion: BeltHistory;
  };
}

/* ======================================================
   GET BELT HISTORY
====================================================== */

export async function getStudentBeltHistory(
  studentId: string,
) {
  const token = getToken();

  const response =
    await fetch(
      `${API_URL}/promotions/history/${studentId}`,
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

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Failed to fetch belt history",
    );
  }

  return data as {
    success: boolean;

    student: {
      _id: string;
      name: string;
      currentBelt: string;
      branch?: PromotionBranch;
      plan?: PromotionPlan;
    };

    history: BeltHistory[];
  };
}