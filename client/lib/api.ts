const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

/* =========================================================
   MODULES (DYNAMIC SIDEBAR)
========================================================= */

export interface NavigationModule {
  _id: string;
  key: string;
  label: string;
  href: string;
  icon: string;
  order: number;
}

export interface ManagedModule extends NavigationModule {
  allowedRoles: string[];
  isActive: boolean;
  isSystem: boolean;
}

export interface ModulePayload {
  key?: string;
  label?: string;
  href?: string;
  icon?: string;
  order?: number;
  allowedRoles?: string[];
  isActive?: boolean;
}

async function moduleRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/modules${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    window.location.href = "/login";

    throw new Error("Authentication required.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

let navigationRequest: Promise<NavigationModule[]> | null = null;
let navigationToken: string | null = null;

/** Sidebar items for the logged-in user. */
export function getMyNavigation(): Promise<NavigationModule[]> {
  const token = localStorage.getItem("token");
  if (navigationRequest && navigationToken === token) {
    return navigationRequest;
  }

  navigationToken = token;

  const request = moduleRequest("/navigation")
    .then((data) =>
      Array.isArray(data?.modules) ? (data.modules as NavigationModule[]) : [],
    )
    .catch((error) => {
      if (navigationRequest === request) {
        navigationRequest = null;
        navigationToken = null;
      }

      throw error;
    })
    .finally(() => {
      if (navigationRequest === request) {
        navigationRequest = null;
        navigationToken = null;
      }
    });

  navigationRequest = request;

  return request;
}

/** Every module (Super Admin only). */
export async function getModules(): Promise<ManagedModule[]> {
  const data = await moduleRequest("");

  return Array.isArray(data?.modules) ? data.modules : [];
}

export async function createModule(
  payload: ModulePayload,
): Promise<ManagedModule> {
  const data = await moduleRequest("", {
    method: "POST",
    body: payload,
  });

  return data.module;
}

export async function updateModule(
  id: string,
  payload: ModulePayload,
): Promise<ManagedModule> {
  const data = await moduleRequest(`/${id}`, {
    method: "PUT",
    body: payload,
  });

  return data.module;
}

export async function deleteModule(id: string) {
  return moduleRequest(`/${id}`, {
    method: "DELETE",
  });
}

export async function reorderModules(items: { id: string; order: number }[]) {
  return moduleRequest("/reorder", {
    method: "PUT",
    body: { items },
  });
}

/** Tell the sidebar to reload its items. */
export function notifyNavigationChanged() {
  navigationRequest = null;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dojoflow:navigation-updated"));
  }
}

/* =========================================================
   MAKEUP CLASSES
========================================================= */

export type MakeupStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface MakeupStudent {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface MakeupBranch {
  _id: string;
  name: string;
  address?: string;
}

export interface MakeupAttendance {
  _id: string;
  date: string;
  planDay: number;
  curriculumTitle?: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  makeupRequired: boolean;
  makeupCompleted: boolean;
}

export interface Makeup {
  _id: string;

  student: string | MakeupStudent;

  branch: string | MakeupBranch;

  originalAttendance: string | MakeupAttendance;

  planDay: number;
  originalDate: string;
  makeupDate: string;

  status: MakeupStatus;

  curriculumTitle?: string;
  notes?: string;

  markedBy?: {
    _id: string;
    name: string;
    email: string;
  };

  completedBy?: {
    _id: string;
    name: string;
    email: string;
  };

  completedAt?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMakeupPayload {
  student: string;
  originalAttendance: string;
  makeupDate: string;
  notes?: string;
}

export interface GetMakeupsParams {
  status?: MakeupStatus;
  student?: string;
  fromDate?: string;
  toDate?: string;
}

/**
 * Get all makeup classes.
 */
export async function getMakeups(params?: GetMakeupsParams) {
  const token = localStorage.getItem("token");

  const searchParams = new URLSearchParams();

  if (params?.status) {
    searchParams.append("status", params.status);
  }

  if (params?.student) {
    searchParams.append("student", params.student);
  }

  if (params?.fromDate) {
    searchParams.append("fromDate", params.fromDate);
  }

  if (params?.toDate) {
    searchParams.append("toDate", params.toDate);
  }

  const queryString = searchParams.toString();

  const response = await fetch(
    `${API_URL}/makeups${queryString ? `?${queryString}` : ""}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch makeup classes");
  }

  return data;
}

/**
 * Get one makeup class by ID.
 */
export async function getMakeupById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/makeups/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch makeup class");
  }

  return data;
}

/**
 * Schedule a new makeup class.
 */
export async function createMakeup(makeup: CreateMakeupPayload) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/makeups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(makeup),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to schedule makeup class");
  }

  return data;
}

/**
 * Mark a scheduled makeup class as completed.
 */
export async function completeMakeup(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/makeups/${id}/complete`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to complete makeup class");
  }

  return data;
}

/**
 * Cancel a scheduled makeup class.
 */
export async function cancelMakeup(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/makeups/${id}/cancel`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to cancel makeup class");
  }

  return data;
}

/* =========================================================
   DASHBOARD
========================================================= */

export async function getDashboard() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/dashboard`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch dashboard");
  }

  return data;
}

/* =========================================================
   STUDENTS
========================================================= */

export interface StudentRecord {
  _id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;

  branch?: {
    _id: string;
    name: string;
  } | null;

  plan?: {
    _id: string;
    name: string;
  } | null;

  currentBelt?: string;

  status: "ACTIVE" | "INACTIVE" | "COMPLETED";

  joinDate: string;
}

export interface StudentsResponse {
  success?: boolean;
  students: StudentRecord[];
  count?: number;
  message?: string;
}

export async function getStudents(): Promise<StudentsResponse> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch students");
  }

  return {
    ...data,
    students: Array.isArray(data?.students) ? data.students : [],
  };
}

export async function createStudent(student: {
  name: string;
  age: number;
  phone: string;
  email?: string;
  branch: string;
  plan: string;
  joinDate: string;
  loginEmail: string;
  loginPassword: string;
}) {
  const token = localStorage.getItem("token");

  const normalizedJoinDate = student.joinDate.trim();
  const [year, month, day] = normalizedJoinDate.split("-").map(Number);
  const parsedJoinDate = new Date(year, month - 1, day);

  if (
    !/^[a-f\d]{24}$/i.test(student.branch) ||
    !/^[a-f\d]{24}$/i.test(student.plan)
  ) {
    throw new Error("Select a valid branch and training plan.");
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(normalizedJoinDate) ||
    parsedJoinDate.getFullYear() !== year ||
    parsedJoinDate.getMonth() !== month - 1 ||
    parsedJoinDate.getDate() !== day
  ) {
    throw new Error("Enter a valid join date in YYYY-MM-DD format.");
  }

  const payload = {
    ...student,
    name: student.name.trim(),
    phone: student.phone.trim(),
    email: student.email?.trim() || "",
    loginEmail: student.loginEmail.trim().toLowerCase(),
    joinDate: normalizedJoinDate,
  };

  const response = await fetch(`${API_URL}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Failed to create student");
  }

  return data;
}

export async function getPlans() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch plans");
  }

  return {
    ...data,
    plans: Array.isArray(data?.plans) ? data.plans : [],
  };
}

export async function getStudentById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch student");
  }

  return data;
}

export async function getStudentProgress(studentId: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/progress/student/${studentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch student progress");
  }

  return data;
}

/* =========================================================
   STUDENT ATTENDANCE
========================================================= */

export async function getStudentAttendance(studentId: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/attendance/student/${studentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch student attendance");
  }

  return data;
}

/* =========================================================
   STUDENT PERFORMANCE
========================================================= */

export async function getStudentPerformance(studentId: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/performance/student/${studentId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch student performance");
  }

  return data;
}

export async function updateStudent(
  id: string,
  data: {
    name?: string;
    age?: number;
    phone?: string;
    email?: string;
    branch?: string;
    plan?: string;
    joinDate?: string;
    currentBelt?: string;
    status?: "ACTIVE" | "INACTIVE" | "COMPLETED";
    password?: string;
  },
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update student");
  }

  return result;
}

export async function deleteStudent(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete student");
  }

  return data;
}

/* =========================================================
   PLANS
========================================================= */

export async function getPlanById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch plan");
  }

  return data;
}

export async function createPlan(plan: {
  name: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek: number;
  startingBelt: string;
  progressReports: string;

  milestones: {
    day: number;
    belt: string;
    skill: string;
    description?: string;
  }[];

  curriculum: {
    day: number;
    title: string;
    description?: string;
    skill?: string;
  }[];
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(plan),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create plan");
  }

  return data;
}

export async function updatePlan(
  id: string,
  plan: Partial<{
    name: string;
    price: number;
    duration: number;
    durationUnit: "MONTHS" | "DAYS";
    classesPerWeek: number;
    startingBelt: string;
    progressReports: string;

    milestones: {
      day: number;
      belt: string;
      skill: string;
      description?: string;
    }[];

    curriculum: {
      day: number;
      title: string;
      description?: string;
      skill?: string;
    }[];

    isActive: boolean;
  }>,
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(plan),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update plan");
  }

  return data;
}

export async function deletePlan(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete plan");
  }

  return data;
}

/* =========================================================
   INQUIRIES
========================================================= */

export const updateInquiryStatus = async (
  id: string,
  status: "NEW" | "CONTACTED" | "ENROLLED" | "CLOSED",
) => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/inquiries/${id}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to update inquiry status.");
  }

  return data;
};

export const getInquiries = async () => {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/inquiries`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to fetch inquiries.");
  }

  return data;
};

/* =========================================================
   BRANCHES
========================================================= */

export interface ApiBranch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
}

export interface BranchesResponse {
  success?: boolean;
  count?: number;
  branches: ApiBranch[];
  message?: string;
}

/**
 * Get all branches.
 *
 * The backend may return branch records in one of
 * several shapes depending on the endpoint/controller:
 *
 * 1. { branches: [...] }
 * 2. [...]
 * 3. { data: [...] }
 * 4. { data: { branches: [...] } }
 *
 * This function normalizes all supported responses into:
 *
 * {
 *   branches: [...]
 * }
 */
export type BranchApiRecord = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
};

export type BranchesApiResponse = {
  success?: boolean;
  count?: number;
  branches: BranchApiRecord[];
  message?: string;
  [key: string]: unknown;
};

export async function getBranches(): Promise<BranchesApiResponse> {
  const token = localStorage.getItem("token");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };

  /*
   * =========================================================
   * PRIMARY SOURCE
   * GET /api/branches
   * =========================================================
   */
  const response = await fetch(`${API_URL}/branches`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  /*
   * Handle expired session.
   */
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }

    throw new Error("Authentication required.");
  }

  /*
   * If the normal branch endpoint works, normalize every
   * possible response shape.
   */
  if (response.ok) {
    const candidates: unknown[] = Array.isArray(result?.branches)
      ? result.branches
      : Array.isArray(result?.data?.branches)
        ? result.data.branches
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result)
            ? result
            : [];

    // Some branch endpoints return schedule rows shaped as
    // { branch: {...}, schedule: ... }; the student form needs the
    // actual branch record. Drop malformed rows before rendering options.
    const branches = candidates
      .map((item: unknown): BranchApiRecord | null => {
        if (!item || typeof item !== "object") return null;
        const record = item as {
          _id?: unknown;
          name?: unknown;
          branch?: { _id?: unknown; name?: unknown; [key: string]: unknown };
        };
        const branch = record.branch || record;
        if (
          !branch._id ||
          typeof branch.name !== "string" ||
          !branch.name.trim()
        ) {
          return null;
        }
        return {
          ...branch,
          _id: String(branch._id),
          name: branch.name.trim(),
        } as BranchApiRecord;
      })
      .filter((branch): branch is BranchApiRecord => Boolean(branch));

    /*
     * Return the exact shape expected by StudentsPage:
     *
     * branchData.branches
     */
    if (branches.length > 0) {
      const uniqueBranches = Array.from(
        new Map(branches.map((branch) => [branch._id, branch])).values(),
      );
      return {
        ...result,
        success: result?.success !== false,
        count: uniqueBranches.length,
        branches: uniqueBranches,
      };
    }
  }

  /*
   * =========================================================
   * FALLBACK SOURCE
   * GET /api/branch-schedules
   *
   * The branch-schedules endpoint already returns the branch
   * records used by the Branch Schedules screen.
   *
   * This prevents the student admission dropdown from becoming
   * empty when the normal /branches response has a different
   * response shape.
   * =========================================================
   */
  try {
    const scheduleResponse = await fetch(`${API_URL}/branch-schedules`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const scheduleResult = await scheduleResponse.json().catch(() => ({}));

    if (scheduleResponse.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("dojoUser");
      localStorage.removeItem("currentUser");

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }

      throw new Error("Authentication required.");
    }

    if (scheduleResponse.ok) {
      let branches: BranchApiRecord[] = [];

      /*
       * Expected branch-schedule response:
       *
       * {
       *   success: true,
       *   count: ...,
       *   branches: [
       *     {
       *       branch: {
       *         _id,
       *         name,
       *         address,
       *         phone,
       *         isActive
       *       },
       *       schedule: ...
       *     }
       *   ]
       * }
       */

      if (Array.isArray(scheduleResult?.branches)) {
        branches = scheduleResult.branches
          .map((item: unknown) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const record = item as {
              branch?: BranchApiRecord;
            };

            if (
              record.branch &&
              typeof record.branch === "object" &&
              record.branch._id &&
              record.branch.name
            ) {
              return record.branch;
            }

            /*
             * Also support a direct branch record if the
             * backend returns one.
             */
            const direct = item as BranchApiRecord;

            if (direct._id && direct.name) {
              return direct;
            }

            return null;
          })
          .filter(
            (branch: BranchApiRecord | null): branch is BranchApiRecord =>
              Boolean(branch),
          );
      }

      if (branches.length > 0) {
        /*
         * Remove accidental duplicates.
         */
        const uniqueBranches = Array.from(
          new Map(
            branches.map((branch: BranchApiRecord) => [String(branch._id), branch]),
          ).values(),
        );

        return {
          success: true,
          count: uniqueBranches.length,
          branches: uniqueBranches,
        };
      }
    }
  } catch (fallbackError) {
    console.error("Branch fallback request failed:", fallbackError);
  }

  /*
   * =========================================================
   * FINAL ERROR
   * =========================================================
   */

  throw new Error(
    typeof result?.message === "string"
      ? result.message
      : "Failed to fetch branches.",
  );
}
/* =========================================================
   CREATE BRANCH
========================================================= */

export async function createBranch(data: {
  name: string;
  address: string;
  phone?: string;
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create branch");
  }

  return result;
}

/* =========================================================
   STAFF USERS
========================================================= */

export async function updateStaffUser(
  id: string,
  data: {
    name: string;
    email: string;
    role: string;
    branch: string;
    password?: string;
  },
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update staff user");
  }

  return result;
}

/* =========================================================
   ROLES
========================================================= */

export type DataScope = "ALL" | "BRANCH";

export interface RoleRecord {
  _id: string;
  key: string;
  name: string;
  description: string;
  dataScope: DataScope;
  isSystem: boolean;
  userCount: number;
}

export interface RolePayload {
  name?: string;
  description?: string;
  dataScope?: DataScope;
}

async function roleRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/roles${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }

    throw new Error("Authentication required.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

/** Every role with its user count (Super Admin only). */
export async function getRoles(): Promise<RoleRecord[]> {
  const data = await roleRequest("");

  return Array.isArray(data?.roles) ? data.roles : [];
}

export async function createRole(payload: RolePayload): Promise<RoleRecord> {
  const data = await roleRequest("", {
    method: "POST",
    body: payload,
  });

  return data.role;
}

export async function updateRole(
  id: string,
  payload: RolePayload,
): Promise<RoleRecord> {
  const data = await roleRequest(`/${id}`, {
    method: "PUT",
    body: payload,
  });

  return data.role;
}

export async function deleteRole(id: string) {
  return roleRequest(`/${id}`, {
    method: "DELETE",
  });
}

/* =========================================================
   CURRENT USER
========================================================= */

export interface CurrentUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  branch?: string | null;
  permissions?: string[];
}

/**
 * The logged-in user as the server knows them right now.
 *
 * /auth/me is the source of truth for the current session.
 */
export async function getCurrentUser(): Promise<CurrentUserRecord> {
  const token = localStorage.getItem("token");

  if (!token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`${API_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("forcstrike:auth-changed"));

      window.location.href = "/login";
    }

    throw new Error("Your session has expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to load authenticated user");
  }

  if (!data.user || typeof data.user !== "object") {
    throw new Error("Invalid authenticated-user response.");
  }

  return data.user as CurrentUserRecord;
}
