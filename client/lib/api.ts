const API_URL = "http://localhost:5000/api";

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