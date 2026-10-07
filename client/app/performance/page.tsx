"use client";

import { fetchWithSession } from "@/lib/sessionFetch";
import { toast } from "@/lib/toast";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  RefreshCw,
  Search,
  Star,
  Users,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTableSection,
  DataFilters,
  DataSort,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  Select,
  SummaryCard,
  TablePagination,
  TableHeading,
  Textarea,
  type ActiveFilter,
} from "@/components/ui";
import { getStudentAttendance, getStudents } from "@/lib/api";
import { PERMISSIONS, useCan } from "@/lib/permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
type Student = {
  _id: string;
  name: string;
  status?: string;
  plan?: { _id: string; name: string } | null;
};
type Record = {
  _id: string;
  student?: { _id: string; name: string } | null;
  branch?: { _id: string; name: string } | null;
  evaluatedBy?: { _id: string; name: string } | null;
  planDay: number;
  curriculumTitle: string;
  skill: string;
  rating: number;
  remarks?: string;
  evaluationDate?: string;
  sessionTypeId?: string | { _id: string; name: string } | null;
  attendance?: string | { _id: string };
};
type EvaluationAttendance = { _id: string; planDay: number; status: string; date: string; curriculumTitle: string; curriculumSkill?: string; sessionName?: string; sessionTypeId?: string | { _id: string; name: string } | null };
const date = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function PerformancePage() {
  const canView = useCan(PERMISSIONS.PERFORMANCE_VIEW);
  const canManage = useCan(PERMISSIONS.PERFORMANCE_MANAGE);
  const canViewStudents = useCan(PERMISSIONS.STUDENT_VIEW);
  const canViewPlans = useCan(PERMISSIONS.PLAN_VIEW);
  const canCreate = canManage && canViewStudents && canViewPlans;
  const [records, setRecords] = useState<Record[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [student, setStudent] = useState("");
  const [day, setDay] = useState("");
  const [skill, setSkill] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [branch, setBranch] = useState("");
  const [coach, setCoach] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedAttendanceId, setSelectedAttendanceId] = useState("");
  const [rating, setRating] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [attendance, setAttendance] = useState<
    EvaluationAttendance[]
  >([]);
  const [saving, setSaving] = useState(false);

  async function load(refresh = false) {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const response = await fetchWithSession(`${API_URL}/performance`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to load performance.");
      setRecords(Array.isArray(data.performance) ? data.performance : []);
      if (canCreate) {
        const s = await getStudents();
        setStudents(s.students || []);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Failed to load performance.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, [canView, canCreate]);
  useEffect(() => {
    if (!open || !selectedStudent) return;
    void getStudentAttendance(selectedStudent)
      .then((data) => setAttendance(data.attendance || []))
      .catch(() => setAttendance([]));
  }, [open, selectedStudent]);

  const branches = useMemo(
    () =>
      Array.from(
        new Map(
          records.flatMap((r) =>
            r.branch ? [[r.branch._id, r.branch.name]] : [],
          ),
        ).entries(),
      ),
    [records],
  );
  const coaches = useMemo(
    () =>
      Array.from(
        new Map(
          records.flatMap((r) =>
            r.evaluatedBy ? [[r.evaluatedBy._id, r.evaluatedBy.name]] : [],
          ),
        ).entries(),
      ),
    [records],
  );
  const days = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.planDay))).sort((a, b) => a - b),
    [records],
  );
  const skills = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.skill).filter(Boolean))).sort(),
    [records],
  );
  const filtered = useMemo(
    () =>
      records
        .filter((r) => {
          const q = search.toLowerCase().trim();
          return (
            (!q ||
              [
                r.student?.name,
                r.skill,
                r.curriculumTitle,
                r.evaluatedBy?.name,
                r.remarks,
              ].some((v) => v?.toLowerCase().includes(q))) &&
            (!student || r.student?._id === student) &&
            (!day || r.planDay === Number(day)) &&
            (!skill || r.skill === skill) &&
            (!ratingFilter || r.rating === Number(ratingFilter)) &&
            (!branch || r.branch?._id === branch) &&
            (!coach || r.evaluatedBy?._id === coach)
          );
        })
        .sort((a, b) =>
          sort === "date-asc"
            ? String(a.evaluationDate).localeCompare(String(b.evaluationDate))
            : sort === "rating-desc"
              ? b.rating - a.rating
              : sort === "rating-asc"
                ? a.rating - b.rating
                : sort === "name-asc"
                  ? (a.student?.name || "").localeCompare(b.student?.name || "")
                  : sort === "name-desc"
                    ? (b.student?.name || "").localeCompare(
                        a.student?.name || "",
                      )
                    : sort === "day-asc"
                      ? a.planDay - b.planDay
                      : sort === "day-desc"
                        ? b.planDay - a.planDay
                        : String(b.evaluationDate).localeCompare(
                            String(a.evaluationDate),
                          ),
        ),
    [records, search, student, day, skill, ratingFilter, branch, coach, sort],
  );
  useEffect(
    () => setPage(1),
    [search, student, day, skill, ratingFilter, branch, coach, sort],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice(
    (Math.min(page, pages) - 1) * pageSize,
    Math.min(page, pages) * pageSize,
  );
  const average = filtered.length
    ? `${(filtered.reduce((sum, r) => sum + r.rating, 0) / filtered.length).toFixed(1)}/5`
    : "—";
  const chips: ActiveFilter[] = [];
  const chip = (id: string, label: string, clear: () => void) =>
    chips.push({ id, label, onClear: clear });
  if (student)
    chip(
      "student",
      students.find((s) => s._id === student)?.name || "Student",
      () => setStudent(""),
    );
  if (day) chip("day", `Day ${day}`, () => setDay(""));
  if (skill) chip("skill", skill, () => setSkill(""));
  if (ratingFilter)
    chip("rating", `${ratingFilter} stars`, () => setRatingFilter(""));
  if (branch)
    chip(
      "branch",
      branches.find(([id]) => id === branch)?.[1] || "Branch",
      () => setBranch(""),
    );
  if (coach)
    chip("coach", coaches.find(([id]) => id === coach)?.[1] || "Coach", () =>
      setCoach(""),
    );
  const clear = () => {
    setSearch("");
    setStudent("");
    setDay("");
    setSkill("");
    setRatingFilter("");
    setBranch("");
    setCoach("");
  };
  const selectedAttendance = attendance.find((item) => item._id === selectedAttendanceId);
  const presentAttendance = attendance.filter((item) => item.status === "PRESENT" && item.sessionTypeId);
  const allowed = selectedAttendance?.status === "PRESENT";
  const stars = (value: number, edit = false) => (
    <div className="flex text-(--gold)">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type={edit ? "button" : undefined}
          disabled={!edit}
          onClick={() => edit && setRating(n)}
        >
          <Star
            size={edit ? 21 : 16}
            fill={n <= value ? "currentColor" : "none"}
            className={n <= value ? "" : "text-(--line-strong)"}
          />
        </button>
      ))}
    </div>
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !selectedAttendance || !allowed || !rating) {
      setFormError("Select a student's attended program session and a rating.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const response = await fetchWithSession(`${API_URL}/performance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student: selectedStudent,
          attendanceId: selectedAttendance._id,
          skill: selectedAttendance.curriculumSkill || selectedAttendance.curriculumTitle,
          rating,
          remarks,
          evaluationDate: new Date().toLocaleDateString("en-CA"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      toast.success("Performance evaluation saved.");
      await load();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to save evaluation.");
    } finally {
      setSaving(false);
    }
  }
  if (!canView)
    return (
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Performance"
          description="Evaluate student skills and track training performance."
        />
        <ErrorState
          title="Access denied"
          message="You do not have permission to view performance data."
        />
      </div>
    );
  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Academy Management"
        title="Performance"
        description="Evaluate student skills and track training performance."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </Button>
            {canCreate && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setSelectedStudent("");
                  setRating(0);
                  setRemarks("");
                  setOpen(true);
                }}
              >
                <Award size={16} />
                Add Evaluation
              </Button>
            )}
          </div>
        }
      />
      {error && <ErrorState title="Unable to load performance" message={error} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Evaluations"
          value={filtered.length}
          subtitle="Evaluations shown"
          icon={<Award size={19} />}
        />
        <SummaryCard
          title="Average Rating"
          value={average}
          subtitle="Average performance rating"
          icon={<Star size={19} />}
        />
        <SummaryCard
          title="Strong Evaluations"
          value={filtered.filter((r) => r.rating >= 4).length}
          subtitle="Ratings from 4 to 5"
          icon={<CheckCircle2 size={19} />}
        />
        <SummaryCard
          title="Needs Attention"
          value={filtered.filter((r) => r.rating <= 2).length}
          subtitle="Ratings from 1 to 2"
          icon={<Users size={19} />}
        />
      </div>
      <DataTableSection className="mt-6" title="Performance History" description="View and manage student performance evaluations." icon={<Users size={18} />} toolbar={
          <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row">
            <div className="relative w-full lg:w-80">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search evaluations..."
                className="pl-10"
              />
            </div>
            <DataFilters activeFilters={chips} onClearAll={clear}>
              <label>
                Student
                <Select
                  value={student}
                  onChange={(e) => setStudent(e.target.value)}
                >
                  <option value="">All students</option>
                  {students.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Training day
                <Select value={day} onChange={(e) => setDay(e.target.value)}>
                  <option value="">All days</option>
                  {days.map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Skill
                <Select
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                >
                  <option value="">All skills</option>
                  {skills.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </label>
              <label>
                Rating
                <Select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                >
                  <option value="">All ratings</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} stars
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Branch
                <Select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                >
                  <option value="">All branches</option>
                  {branches.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                Coach
                <Select
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                >
                  <option value="">All coaches</option>
                  {coaches.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </Select>
              </label>
            </DataFilters>
            <DataSort
              value={sort}
              onChange={setSort}
              options={[
                { value: "date-desc", label: "Newest first" },
                { value: "date-asc", label: "Oldest first" },
                { value: "rating-desc", label: "Highest rating" },
                { value: "rating-asc", label: "Lowest rating" },
                { value: "name-asc", label: "Student name: A to Z" },
                { value: "name-desc", label: "Student name: Z to A" },
                { value: "day-asc", label: "Training day: low to high" },
                { value: "day-desc", label: "Training day: high to low" },
              ]}
            />
          </div>
      }>
        {loading ? (
          <LoadingSpinner fullPage text="Loading performance data..." />
        ) : !filtered.length ? (
          <EmptyState
            title="No evaluations found"
            description="Try changing your search or filters."
            icon={<Award size={22} />}
            action={
              chips.length || search ? (
                <Button variant="outline" onClick={clear}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="border-b border-(--line) bg-(--surface)">
                  <tr>
                    {[
                      "Student",
                      "Training",
                      "Skill / Category",
                      "Rating",
                      "Coach",
                      "Evaluated",
                      "Remarks",
                    ].map((h) => (
                      <TableHeading key={h}>{h}</TableHeading>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-(--line)">
                  {shown.map((r) => (
                    <tr key={r._id}>
                      <td className="px-6 py-5 text-[15px] font-semibold leading-5 text-(--foreground-soft)">
                        {r.student?.name || "Unknown Student"}
                      </td>
                      <td className="px-6 py-5 text-[15px] leading-5 text-(--foreground-soft)">{r.sessionTypeId && typeof r.sessionTypeId === "object" ? r.sessionTypeId.name : "Program"} · Day {r.planDay}</td>
                      <td className="px-6 py-5">
                        <Badge variant="default">
                          {r.skill || r.curriculumTitle}
                        </Badge>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-[15px] font-medium leading-5 text-(--foreground-soft)">
                          {stars(r.rating)}
                          <span>{r.rating}/5</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-[15px] leading-5 text-(--foreground-soft)">
                        {r.evaluatedBy?.name || "—"}
                      </td>
                      <td className="px-6 py-5 text-[15px] leading-5 text-(--foreground-soft)">{date(r.evaluationDate)}</td>
                      <td className="max-w-52 truncate px-6 py-5 text-sm leading-5 text-(--ink-muted)">
                        {r.remarks || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              currentPage={Math.min(page, pages)}
              totalPages={pages}
              pageSize={pageSize}
              totalItems={filtered.length}
              visibleItems={shown.length}
              entityLabel="evaluations"
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(pages, p + 1))}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </DataTableSection>
      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Add Evaluation"
        description="Record a student's performance for a training day."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="evaluation-form"
              loading={saving}
              disabled={!allowed || !rating}
            >
              Save Evaluation
            </Button>
          </>
        }
        >
        {formError && <p role="alert" className="mb-3 rounded-lg border border-(--danger)/20 bg-(--danger-soft) px-3 py-2 text-sm text-(--danger)">{formError}</p>}
        <form
          id="evaluation-form"
          onSubmit={submit}
          className="grid gap-4 sm:grid-cols-2"
        >
          <label>
            Student
            <Select
              value={selectedStudent}
              onChange={(e) => {
                setSelectedStudent(e.target.value);
                      setSelectedAttendanceId("");
                setRating(0);
              }}
            >
              <option value="">Select student</option>
              {students
                .filter(
                  (s) => s.status !== "INACTIVE" && s.status !== "COMPLETED",
                )
                .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Attended Session
            <Select
              value={selectedAttendanceId}
              onChange={(e) => setSelectedAttendanceId(e.target.value)}
            >
              <option value="">Select an attended session</option>
              {presentAttendance.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.sessionTypeId && typeof item.sessionTypeId === "object" ? item.sessionTypeId.name : "Program"} · {item.sessionName || item.curriculumTitle} · Day {item.planDay}
                </option>
              ))}
            </Select>
          </label>
          <div className="sm:col-span-2 rounded-xl border border-(--line) bg-(--surface) p-3">
            {selectedAttendance?.curriculumTitle || "Select an attended program session"}
            {selectedStudent && presentAttendance.length === 0 && (
              <p className="mt-2 text-sm text-(--danger)">
                No program-linked present sessions are available for evaluation.
              </p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-semibold">Rating</p>
            {stars(rating, true)}
          </div>
          <label className="sm:col-span-2">
            Remarks
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="resize-none"
              placeholder="Add feedback..."
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
