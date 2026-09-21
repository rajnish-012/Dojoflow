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

  // Expired or invalid login: clear it and go to the login page.
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    window.location.href = "/login";
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// The sidebar and the page guard both need the menu. They share one
// request instead of each asking the server separately.
let navigationRequest: Promise<NavigationModule[]> | null = null;
let navigationToken: string | null = null;
let navigationAt = 0;

const NAVIGATION_SHARE_MS = 5000;

/** Sidebar items for the logged-in user. */
export function getMyNavigation(): Promise<NavigationModule[]> {
  const token = localStorage.getItem("token");
  const now = Date.now();

  if (
    navigationRequest &&
    navigationToken === token &&
    now - navigationAt < NAVIGATION_SHARE_MS
  ) {
    return navigationRequest;
  }

  navigationToken = token;
  navigationAt = now;

  const request = moduleRequest("/navigation")
    .then((data) => data.modules as NavigationModule[])
    .catch((error) => {
      // Do not remember a failed request.
      if (navigationRequest === request) {
        navigationRequest = null;
      }

      throw error;
    });

  navigationRequest = request;

  return request;
}

/** Every module (Super Admin only). */
export async function getModules(): Promise<ManagedModule[]> {
  const data = await moduleRequest("");

  return data.modules;
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
  return moduleRequest(`/${id}`, { method: "DELETE" });
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

  window.dispatchEvent(new Event("dojoflow:navigation-updated"));
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

export async function getStudents() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch students");
  }

  return data;
}

export async function createStudent(student: {
  name: string;
  age: number;
  phone: string;
  email?: string;
  branch: string;
  plan: string;
  loginEmail?: string;
  loginPassword?: string;
}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(student),
  });

  const data = await response.json();

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
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch plans");
  }

  return data;
}

export async function getStudentById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/students/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

export async function getPlanById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/plans/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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

export const updateInquiryStatus = async (
  id: string,
  status: "NEW" | "CONTACTED" | "ENROLLED" | "CLOSED",
) => {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
    }/inquiries/${id}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to update inquiry status.");
  }

  return data;
};

export const getInquiries = async () => {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/inquiries`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to fetch inquiries.");
  }

  return data;
};

export async function getBranches() {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/branches`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch branches");
  }

  return result;
}

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

    window.location.href = "/login";
  }

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

/** Every role with its user count (Super Admin only). */
export async function getRoles(): Promise<RoleRecord[]> {
  const data = await roleRequest("");

  return data.roles;
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
  return roleRequest(`/${id}`, { method: "DELETE" });
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
}

/** The logged-in user as the server knows them right now. */
export async function getCurrentUser(): Promise<CurrentUserRecord> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  // Expired login, or the account was deleted.
  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("dojoUser");
    localStorage.removeItem("currentUser");

    window.location.href = "/login";
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to load user");
  }

  return data.user;
}
