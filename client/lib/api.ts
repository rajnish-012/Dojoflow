const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");


/* =========================================================
   MAKEUP CLASSES
========================================================= */

export type MakeupStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED";

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
  student:
    | string
    | MakeupStudent;

  branch:
    | string
    | MakeupBranch;

  originalAttendance:
    | string
    | MakeupAttendance;

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
export async function getMakeups(
  params?: GetMakeupsParams
) {
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
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch makeup classes"
    );
  }

  return data;
}

/**
 * Get one makeup class by ID.
 */
export async function getMakeupById(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/makeups/${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch makeup class"
    );
  }

  return data;
}

/**
 * Schedule a new makeup class.
 */
export async function createMakeup(
  makeup: CreateMakeupPayload
) {
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
    throw new Error(
      data.message || "Failed to schedule makeup class"
    );
  }

  return data;
}

/**
 * Mark a scheduled makeup class as completed.
 */
export async function completeMakeup(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/makeups/${id}/complete`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to complete makeup class"
    );
  }

  return data;
}

/**
 * Cancel a scheduled makeup class.
 */
export async function cancelMakeup(id: string) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/makeups/${id}/cancel`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to cancel makeup class"
    );
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

  const response = await fetch(
    `${API_URL}/progress/student/${studentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch student progress"
    );
  }

  return data;
}


/* =========================================================
   STUDENT ATTENDANCE
========================================================= */

export async function getStudentAttendance(
  studentId: string
) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/attendance/student/${studentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch student attendance"
    );
  }

  return data;
}


/* =========================================================
   STUDENT PERFORMANCE
========================================================= */

export async function getStudentPerformance(
  studentId: string
) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${API_URL}/performance/student/${studentId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to fetch student performance"
    );
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
  }>
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
  status: "NEW" | "CONTACTED" | "ENROLLED" | "CLOSED"
) => {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:5000/api"
    }/inquiries/${id}/status`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Unable to update inquiry status."
    );
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
    role: "BRANCH_ADMIN" | "COACH";
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
    throw new Error(
      result.message || "Failed to update staff user",
    );
  }

  return result;
}




