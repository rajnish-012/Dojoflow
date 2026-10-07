"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { Award, CalendarDays, Clock3, GraduationCap, RefreshCw, Users } from "lucide-react";
import { Badge, Button, Card, ErrorState, Input, LoadingSpinner, PageHeader, Select, SummaryCard } from "@/components/ui";
import { fetchWithSession } from "@/lib/sessionFetch";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
type TimeRange = { dayOfWeek: number; startTime: string; endTime: string };
type Leave = { _id?: string; startDate: string; endDate: string; reason: string };
type Unavailable = TimeRange & { date?: string; reason?: string };
type CoachAvailability = { workingHours: TimeRange[]; leave: Leave[]; unavailableSlots: Unavailable[] };
type ClassSchedule = { dayOfWeek: number; sessionName: string; startTime: string; endTime: string };
type Assignment = { _id: string; student?: { _id: string; name: string; currentBelt?: string; status?: string; plan?: { name?: string } } };
type CoachMetrics = { _id: string; name: string; email?: string; branch?: { name?: string }; attendance?: { attendanceRate: number; present: number; absent: number }; performance?: { evaluations: number }; studentsAssigned?: number; activeStudents?: number; completedStudents?: number; promotions?: number; programs?: { _id: string; name: string }[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithSession(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const result = await response.json(); if (!response.ok) throw new Error(result.message || "Request failed."); return result;
}

export default function CoachProfilePage() {
  const coachId = String(useParams()?.coachId || "");
  const [coach, setCoach] = useState<CoachMetrics | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<CoachAvailability>({ workingHours: [], leave: [], unavailableSlots: [] });
  const [classSchedule, setClassSchedule] = useState<ClassSchedule[]>([]);
  const [leaveDraft, setLeaveDraft] = useState({ startDate: "", endDate: "", reason: "" });
  const [unavailableDraft, setUnavailableDraft] = useState<Unavailable>({ dayOfWeek: 1, startTime: "12:00", endTime: "13:00", reason: "" });
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const year = new Date().getFullYear();
      const [availabilityResult, reportResult] = await Promise.all([
        request<{ coach: CoachMetrics; availability: CoachAvailability; schedule: ClassSchedule[]; assignments: Assignment[] }>(`/coach-assignments/coaches/${coachId}/availability`),
        request<{ data: CoachMetrics[] }>(`/reports/coaches?year=${year}`),
      ]);
      setCoach(reportResult.data.find((item) => item._id === coachId) || availabilityResult.coach);
      setAvailability(availabilityResult.availability); setAssignments(availabilityResult.assignments || []);
      setClassSchedule(availabilityResult.schedule || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load coach profile."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!coachId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const year = new Date().getFullYear();
        const [availabilityResult, reportResult] = await Promise.all([
          request<{ coach: CoachMetrics; availability: CoachAvailability; schedule: ClassSchedule[]; assignments: Assignment[] }>(`/coach-assignments/coaches/${coachId}/availability`),
          request<{ data: CoachMetrics[] }>(`/reports/coaches?year=${year}`),
        ]);
        if (cancelled) return;
        setCoach(reportResult.data.find((item) => item._id === coachId) || availabilityResult.coach);
        setAvailability(availabilityResult.availability); setAssignments(availabilityResult.assignments || []);
        setClassSchedule(availabilityResult.schedule || []);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load coach profile."); }
      finally { if (!cancelled) setLoading(false); }
    };
    void run();
    return () => { cancelled = true; };
  }, [coachId]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const result = await request<{ availability: CoachAvailability }>(`/coach-assignments/coaches/${coachId}/availability`, { method: "PUT", body: JSON.stringify(availability) });
      setAvailability(result.availability);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save availability."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="df-page"><LoadingSpinner text="Loading coach profile..." /></div>;
  if (error && !coach) return <div className="df-page"><ErrorState title="Coach profile unavailable" message={error} action={<Button onClick={() => void load()}>Retry</Button>} /></div>;
  return <div className="df-page">
    <PageHeader eyebrow="Coach Management" title={coach?.name || "Coach Profile"} description={`${coach?.email || "Coach account"}${coach?.branch?.name ? ` · ${coach.branch.name}` : ""}`} actions={<Button variant="outline" onClick={() => void load()}><RefreshCw size={16} />Refresh</Button>} />
    {error && <p className="mb-4 text-sm text-(--danger)">{error}</p>}
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryCard title="Assigned students" value={coach?.studentsAssigned || assignments.length} icon={<Users size={18} />} />
      <SummaryCard title="Active students" value={coach?.activeStudents || 0} />
      <SummaryCard title="Completed students" value={coach?.completedStudents || 0} />
      <SummaryCard title="Attendance rate" value={`${coach?.attendance?.attendanceRate || 0}%`} subtitle={`${coach?.attendance?.present || 0} present · ${coach?.attendance?.absent || 0} absent`} />
      <SummaryCard title="Promotions / evaluations" value={`${coach?.promotions || 0} / ${coach?.performance?.evaluations || 0}`} icon={<Award size={18} />} />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <Card padding="md"><div className="mb-4 flex items-center gap-2"><GraduationCap size={18} /><h2 className="font-bold">Programs and students</h2></div>
        <p className="mb-4 text-sm text-(--ink-muted)">{coach?.programs?.map((item) => item.name).join(", ") || "No assigned program data"}</p>
        <div className="max-h-96 space-y-2 overflow-y-auto">{assignments.map((item) => <div key={item._id} className="flex items-center justify-between rounded-lg border border-(--line) p-3"><div><p className="font-semibold">{item.student?.name || "Student"}</p><p className="text-xs text-(--ink-muted)">{item.student?.plan?.name || "Plan not assigned"}</p></div><Badge variant={item.student?.status === "ACTIVE" ? "success" : "neutral"}>{item.student?.status || "Assigned"}</Badge></div>)}</div>
      </Card>
      <Card padding="md"><div className="mb-4 flex items-center gap-2"><CalendarDays size={18} /><h2 className="font-bold">Availability and leave</h2></div>
        <div className="mb-5 rounded-xl border border-(--line) p-3"><h3 className="mb-2 text-sm font-semibold">Scheduled classes</h3>{classSchedule.length ? classSchedule.map((item, index) => <p key={`${item.dayOfWeek}-${index}`} className="text-sm text-(--ink-muted)">{DAYS[item.dayOfWeek]} · {item.sessionName} · {item.startTime}–{item.endTime}</p>) : <p className="text-sm text-(--ink-muted)">No recurring classes assigned.</p>}</div>
        <form onSubmit={save} className="space-y-5">
          <section><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Working hours</h3><Button type="button" variant="outline" size="sm" onClick={() => setAvailability((current) => ({ ...current, workingHours: [...current.workingHours, { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }))}><Clock3 size={14} />Add hours</Button></div>
            {availability.workingHours.map((item, index) => <div key={`${item.dayOfWeek}-${index}`} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2"><Select aria-label="Working day" value={item.dayOfWeek} onChange={(e) => setAvailability((current) => ({ ...current, workingHours: current.workingHours.map((entry, i) => i === index ? { ...entry, dayOfWeek: Number(e.target.value) } : entry) }))}>{DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</Select><Input aria-label="Work starts" type="time" value={item.startTime} onChange={(e) => setAvailability((current) => ({ ...current, workingHours: current.workingHours.map((entry, i) => i === index ? { ...entry, startTime: e.target.value } : entry) }))} /><Input aria-label="Work ends" type="time" value={item.endTime} onChange={(e) => setAvailability((current) => ({ ...current, workingHours: current.workingHours.map((entry, i) => i === index ? { ...entry, endTime: e.target.value } : entry) }))} /><Button type="button" variant="ghost" onClick={() => setAvailability((current) => ({ ...current, workingHours: current.workingHours.filter((_, i) => i !== index) }))}>Remove</Button></div>)}
          </section>
          <section><h3 className="mb-2 text-sm font-semibold">Leave</h3><div className="grid gap-2 sm:grid-cols-3"><Input aria-label="Leave start" type="date" value={leaveDraft.startDate} onChange={(e) => setLeaveDraft({ ...leaveDraft, startDate: e.target.value })} /><Input aria-label="Leave end" type="date" value={leaveDraft.endDate} onChange={(e) => setLeaveDraft({ ...leaveDraft, endDate: e.target.value })} /><Input aria-label="Leave reason" placeholder="Reason" value={leaveDraft.reason} onChange={(e) => setLeaveDraft({ ...leaveDraft, reason: e.target.value })} /></div><Button className="mt-2" type="button" variant="outline" onClick={() => { if (leaveDraft.startDate && leaveDraft.endDate) { setAvailability((current) => ({ ...current, leave: [...current.leave, leaveDraft] })); setLeaveDraft({ startDate: "", endDate: "", reason: "" }); } }}>Add leave</Button><ul className="mt-2 space-y-1">{availability.leave.map((item, index) => <li key={item._id || index} className="flex justify-between text-sm">{item.startDate.slice(0, 10)} – {item.endDate.slice(0, 10)} {item.reason}<button type="button" onClick={() => setAvailability((current) => ({ ...current, leave: current.leave.filter((_, i) => i !== index) }))}>Remove</button></li>)}</ul></section>
          <section><h3 className="mb-2 text-sm font-semibold">Unavailable weekly slots</h3><div className="grid grid-cols-3 gap-2"><Select aria-label="Unavailable day" value={unavailableDraft.dayOfWeek} onChange={(e) => setUnavailableDraft({ ...unavailableDraft, dayOfWeek: Number(e.target.value) })}>{DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</Select><Input aria-label="Unavailable start" type="time" value={unavailableDraft.startTime} onChange={(e) => setUnavailableDraft({ ...unavailableDraft, startTime: e.target.value })} /><Input aria-label="Unavailable end" type="time" value={unavailableDraft.endTime} onChange={(e) => setUnavailableDraft({ ...unavailableDraft, endTime: e.target.value })} /></div><Button className="mt-2" type="button" variant="outline" onClick={() => setAvailability((current) => ({ ...current, unavailableSlots: [...current.unavailableSlots, unavailableDraft] }))}>Add unavailable slot</Button>{availability.unavailableSlots.map((item, index) => <p key={index} className="mt-1 text-sm text-(--ink-muted)">{DAYS[item.dayOfWeek]} {item.startTime}–{item.endTime} <button type="button" onClick={() => setAvailability((current) => ({ ...current, unavailableSlots: current.unavailableSlots.filter((_, i) => i !== index) }))}>Remove</button></p>)}</section>
          <Button type="submit" loading={saving}>Save availability</Button>
        </form>
      </Card>
    </div>
  </div>;
}
