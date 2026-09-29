const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(
  path: string,
  options: RequestInit = {},
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
      cache: "no-store",
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Coach assignment request failed.",
    );
  }

  return data;
}

export type CoachAssignmentCoach = {
  _id: string;
  name: string;
  email: string;
  role: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
};

export type CoachAssignmentStudent = {
  _id: string;
  name: string;
  age?: number;
  phone?: string;
  currentBelt?: string;
  status?: string;
  branch?: {
    _id: string;
    name: string;
  } | null;
  plan?: {
    _id: string;
    name: string;
  } | null;
};

export type CoachAssignment = {
  _id: string;

  coach: CoachAssignmentCoach;

  student: CoachAssignmentStudent;

  branch?: {
    _id: string;
    name: string;
  } | null;

  assignedBy?: {
    _id: string;
    name: string;
    email?: string;
  } | null;

  status:
    | "ACTIVE"
    | "INACTIVE";

  assignedAt: string;

  unassignedAt?: string | null;

  note?: string;
};

export async function getCoachAssignmentCoaches() {
  return request(
    "/coach-assignments/coaches",
  );
}

export async function getCoachAssignments(
  params?: {
    coach?: string;
    student?: string;
    status?:
      | "ACTIVE"
      | "INACTIVE";
  },
) {
  const search =
    new URLSearchParams();

  if (params?.coach) {
    search.set(
      "coach",
      params.coach,
    );
  }

  if (params?.student) {
    search.set(
      "student",
      params.student,
    );
  }

  if (params?.status) {
    search.set(
      "status",
      params.status,
    );
  }

  const query =
    search.toString();

  return request(
    `/coach-assignments${
      query ? `?${query}` : ""
    }`,
  );
}

export async function assignStudentToCoach(
  data: {
    coach: string;
    student: string;
    note?: string;
  },
) {
  return request(
    "/coach-assignments",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function unassignStudentFromCoach(
  id: string,
) {
  return request(
    `/coach-assignments/${id}`,
    {
      method: "DELETE",
    },
  );
}

export async function getMyAssignedStudents() {
  return request(
    "/coach-assignments/my-students",
  );
}