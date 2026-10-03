import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface ReportSummary {
  year: number;

  overview: {
    totalStudents: number;
    activeStudents: number;
    inactiveStudents: number;
    completedStudents: number;
    newAdmissions: number;
    retentionRate: number;
    averageAttendance: number;
    averagePerformance: number;
    beltsEarned: number;
    activeBranches: number;
  };

  attendance: {
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
    absenceRate: number;

    trend: {
      month: string;
      present: number;
      absent: number;
      total: number;
      attendanceRate: number;
    }[];
  };

  performance: {
    averageRating: number;
    evaluations: number;
    skillCompletionRate: number;
  };

  belts: {
    earned: number;

    trend: {
      month: string;
      count: number;
    }[];
  };

  makeups: {
    scheduled: number;
    completed: number;
    cancelled: number;
  };

  students: {
    total: number;
    active: number;
    inactive: number;
    completed: number;
    newAdmissions: number;
    retentionRate: number;
  };
}

export interface BranchReport {
  _id: string;
  name: string;
  address?: string;
  status?: string;

  students: {
    total: number;
    active: number;
    inactive: number;
    newAdmissions: number;
  };

  attendance: {
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
  };

  performance: {
    averageRating: number;
    evaluations: number;
  };

  promotions: number;

  makeups: {
    scheduled: number;
    completed: number;
    cancelled: number;
  };
}

export interface CoachReport {
  _id: string;
  name: string;
  email?: string;

  branch?: {
    _id: string;
    name: string;
  } | null;

  attendance: {
    total: number;
    present: number;
    absent: number;
    attendanceRate: number;
  };

  performance: {
    averageRating: number;
    evaluations: number;
  };

  studentsEvaluated: number;
}

export interface BeltReport {
  belt: string;
  count: number;
}

export interface BeltTransition {
  from: string;
  to: string;
  count: number;
}

export interface BeltReports {
  year: number;
  totalPromotions: number;

  distribution: BeltReport[];

  monthly: {
    month: string;
    count: number;
  }[];

  transitions: BeltTransition[];
}

export interface TopPerformer {
  _id: string;

  student: {
    _id: string;
    name: string;
    currentBelt?: string;
  };

  branch?: {
    _id: string;
    name: string;
  };

  averageRating: number;
  evaluations: number;
  skillsCompleted: number;
  attendanceRate: number;
  performanceScore: number;
}

export interface SkillReport {
  belt: string;

  totalEvaluations: number;
  totalCompleted: number;
  completionRate: number;
  averageRating: number;

  skills: {
    skill: string;
    evaluations: number;
    completed: number;
    completionRate: number;
  }[];
}

export interface AdmissionReports {
  year: number;
  newAdmissions: number;

  monthly: {
    month: string;
    count: number;
  }[];

  pipeline: {
    new: number;
    contacted: number;
    enrolled: number;
    closed: number;
  };

  pipelineAvailable: boolean;
}

export interface ReportBranchOption {
  _id: string;
  name: string;
  status?: string;
}

/*
|--------------------------------------------------------------------------
| Request Helper
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Authenticated requests use the server-managed session cookie.
|
| It does NOT send:
| - permissions
| - role
| - branch authorization
|
| The backend resolves those values from the database.
|--------------------------------------------------------------------------
*/

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetchWithSession(`${API_URL}${endpoint}`, {
    method: "GET",

    headers: {
      "Content-Type": "application/json",

    },

    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed with status ${response.status}`,
    );
  }

  return data;
}

function buildQuery(year?: number, branch?: string): string {
  const params = new URLSearchParams();

  if (year) {
    params.set("year", String(year));
  }

  if (branch) {
    params.set("branch", branch);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

/*
|--------------------------------------------------------------------------
| Summary
|--------------------------------------------------------------------------
*/

export async function getReportsSummary(
  year: number,
  branch?: string,
): Promise<ReportSummary> {
  const response = await request<{
    success: boolean;
    data: ReportSummary;
  }>(`/reports/summary${buildQuery(year, branch)}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Top Performers
|--------------------------------------------------------------------------
*/

export async function getTopPerformers(
  year: number,
  branch?: string,
): Promise<TopPerformer[]> {
  const response = await request<{
    success: boolean;
    data: TopPerformer[];
  }>(`/reports/top-performers${buildQuery(year, branch)}`);

  return response.data || [];
}

/*
|--------------------------------------------------------------------------
| Skill Completion
|--------------------------------------------------------------------------
*/

export async function getSkillCompletion(
  year: number,
  branch?: string,
): Promise<SkillReport[]> {
  const response = await request<{
    success: boolean;
    data: SkillReport[];
  }>(`/reports/skills${buildQuery(year, branch)}`);

  return response.data || [];
}

/*
|--------------------------------------------------------------------------
| Branch Reports
|--------------------------------------------------------------------------
*/

export async function getBranchReports(
  year: number,
  branch?: string,
): Promise<BranchReport[]> {
  const response = await request<{
    success: boolean;
    data: BranchReport[];
  }>(`/reports/branches${buildQuery(year, branch)}`);

  return response.data || [];
}

/*
|--------------------------------------------------------------------------
| Coach Reports
|--------------------------------------------------------------------------
*/

export async function getCoachReports(
  year: number,
  branch?: string,
): Promise<CoachReport[]> {
  const response = await request<{
    success: boolean;
    data: CoachReport[];
  }>(`/reports/coaches${buildQuery(year, branch)}`);

  return response.data || [];
}

/*
|--------------------------------------------------------------------------
| Belt Reports
|--------------------------------------------------------------------------
*/

export async function getBeltReports(
  year: number,
  branch?: string,
): Promise<BeltReports> {
  const response = await request<{
    success: boolean;
    data: BeltReports;
  }>(`/reports/belts${buildQuery(year, branch)}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Admission Reports
|--------------------------------------------------------------------------
*/

export async function getAdmissionReports(
  year: number,
  branch?: string,
): Promise<AdmissionReports> {
  const response = await request<{
    success: boolean;
    data: AdmissionReports;
  }>(`/reports/admissions${buildQuery(year, branch)}`);

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Branch Filter Options
|--------------------------------------------------------------------------
*/

export async function getReportBranches(): Promise<ReportBranchOption[]> {
  const response = await request<{
    success: boolean;
    data: ReportBranchOption[];
  }>("/reports/branch-options");

  return response.data || [];
}
