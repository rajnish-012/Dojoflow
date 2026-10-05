import { fetchWithSession } from "@/lib/sessionFetch";
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api";

export type TimelineStatus =
  | "COMPLETED"
  | "MAKEUP_COMPLETED"
  | "MISSED"
  | "UPCOMING";

export type TimelineType =
  | "TRAINING"
  | "MILESTONE";

export interface TimelineAttendance {
  _id: string;
  date: string;
  status: "PRESENT" | "ABSENT";
  sessionName?: string;
  sessionStartTime?: string;
  sessionEndTime?: string;
  makeupRequired: boolean;
  makeupCompleted: boolean;
}

export interface TimelineMakeup {
  _id: string;
  status:
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED";
  originalDate: string;
  makeupDate: string | null;
}

export interface TimelineMilestone {
  day: number;
  belt: string;
  skill: string;
  description: string;
}

export interface TrainingTimelineItem {
  day: number;
  date: string | null;
  type: TimelineType;

  title: string;
  description: string;
  skill: string;

  status: TimelineStatus;
  statusLabel: string;

  attendance: TimelineAttendance | null;
  makeup: TimelineMakeup | null;
  milestone: TimelineMilestone | null;
}

export interface TimelineStudent {
  _id: string;
  name: string;
  currentBelt: string;
  joinDate: string;
  status: string;

  branch: {
    _id: string;
    name: string;
    address?: string;
  } | null;

  plan: {
    _id: string;
    name: string;
    startingBelt: string;
    duration: number | null;
    durationUnit: string;
    classesPerWeek: number | null;
  };
}

export interface TimelineCurrentMilestone {
  day: number;
  belt: string;
  skill: string;
  description: string;
}

export interface TimelineNextMilestone
  extends TimelineCurrentMilestone {
  date: string | null;
}

export interface StudentTimelineSummary {
  totalTrainingDays: number;
  totalMilestones: number;
  completedTrainingDay: number;

  currentBelt: string;

  currentMilestone:
    | TimelineCurrentMilestone
    | null;

  nextMilestone:
    | TimelineNextMilestone
    | null;

  today: string;
}

export interface StudentTimelineResponse {
  success: boolean;

  student: TimelineStudent;

  summary: StudentTimelineSummary;

  timeline: TrainingTimelineItem[];
  program?: { _id: string; name?: string } | string;
  programs?: ({ _id: string; name?: string } | string)[];
}


async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithSession(
    `${API_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "Failed to fetch student timeline."
    );
  }

  return data;
}

export async function getStudentTimeline(
  studentId: string,
  programId?: string,
) {
  const query = programId ? `?programId=${encodeURIComponent(programId)}` : "";
  return request<StudentTimelineResponse>(
    `/students/${studentId}/timeline${query}`
  );
}
