"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award,ArrowLeft, FileBadge, Plus, Printer } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
} from "@/components/ui";
import { getStudents } from "@/lib/api";
import {
  getCompletionCandidates,
  issueAchievementCertificate,
  issueCompletionCertificate,
  listCertificates,
  type CertificateRecord,
} from "@/lib/gradingApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";

type StudentChoice = { _id: string; name: string };
type CompletionChoice = { studentId: string; studentName: string; branch: string; enrollmentId: string; programId: string; programName: string };

export default function CertificatesPage() {
  const canView = useCan(PERMISSIONS.CERTIFICATE_VIEW);
  const canGenerate = useCan(PERMISSIONS.CERTIFICATE_GENERATE);
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [students, setStudents] = useState<StudentChoice[]>([]);
  const [completions, setCompletions] = useState<CompletionChoice[]>([]);
  const [loading, setLoading] = useState(canView);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [achievement, setAchievement] = useState("");
  const [completionKey, setCompletionKey] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [certData, completionData] = await Promise.all([
        listCertificates(),
        getCompletionCandidates(),
      ]);
      setCertificates(certData.certificates || []);
      setCompletions(completionData.completions || []);
      try {
        const studentData = await getStudents({ limit: 100, status: "ACTIVE" });
        setStudents((studentData.students || []).map(({ _id, name }) => ({ _id, name })));
      } catch {
        setStudents([]);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load certificates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!canView) return;
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [canView, load]);

  async function generateAchievement() {
    if (!studentId || achievement.trim().length < 3)
      return toast.error("Select a student and enter an achievement title.");
    try {
      setBusy(true);
      const result = await issueAchievementCertificate({
        studentId,
        achievement,
      });
      router.push(`/certificates/${result.certificate._id}`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to issue achievement certificate.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function generateCompletion() {
    const candidate = completions.find(
      (item) =>
        `${item.studentId}:${item.enrollmentId}:${item.programId}` ===
        completionKey,
    );
    if (!candidate) return toast.error("Choose a completed program.");
    try {
      setBusy(true);
      const result = await issueCompletionCertificate({
        studentId: candidate.studentId,
        enrollmentId: candidate.enrollmentId,
        programId: candidate.programId,
      });
      router.push(`/certificates/${result.certificate._id}`);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Unable to issue program certificate.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Certificates"
        description="Issue printable certificates for completed programs and academy achievements."
        eyebrow="Academy records"
        actions={
          <Link href="/grading">
            <Button variant="back">
              <ArrowLeft size={16} />
              Back to grading</Button>
          </Link>
        }
      />
      {canGenerate && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Award size={18} className="text-(--accent)" />
              Program completion
            </h2>
            <p className="mt-1 text-sm text-(--ink-muted)">
              Only completed enrollment records are available.
            </p>
            <label className="mt-4 block text-xs font-semibold text-(--ink-muted)">
              Completed student program
              <Select
                className="mt-1"
                value={completionKey}
                onChange={(e) => setCompletionKey(e.target.value)}
              >
                <option value="">Choose student and program</option>
                {completions.map((item) => (
                  <option
                    key={`${item.studentId}:${item.enrollmentId}:${item.programId}`}
                    value={`${item.studentId}:${item.enrollmentId}:${item.programId}`}
                  >
                    {item.studentName} · {item.programName} · {item.branch}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              className="mt-4"
              loading={busy}
              disabled={!completionKey || busy}
              onClick={() => void generateCompletion()}
            >
              Generate completion certificate
            </Button>
          </Card>
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-bold">
              <Plus size={18} className="text-(--accent)" />
              Academy achievement
            </h2>
            <p className="mt-1 text-sm text-(--ink-muted)">
              Record an academy-defined achievement for a student.
            </p>
            <label className="mt-4 block text-xs font-semibold text-(--ink-muted)">
              Student
              <Select
                className="mt-1"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Choose student</option>
                {students.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-(--ink-muted)">
              Achievement title
              <Input
                className="mt-1"
                value={achievement}
                maxLength={160}
                onChange={(e) => setAchievement(e.target.value)}
                placeholder="e.g. Tournament Spirit Award"
              />
            </label>
            <Button
              className="mt-4"
              loading={busy}
              disabled={!studentId || achievement.trim().length < 3 || busy}
              onClick={() => void generateAchievement()}
            >
              Generate achievement certificate
            </Button>
          </Card>
        </div>
      )}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <ErrorState
          title="Certificates unavailable"
          message={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : certificates.length ? (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-(--line)">
            {certificates.map((certificate) => (
              <div
                key={certificate._id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                    <FileBadge size={18} />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {(typeof certificate.student === "object"
                        ? certificate.student?.name
                        : "") || certificate.studentName} ·{" "}
                      {certificate.belt ||
                        certificate.achievement ||
                        certificate.programName ||
                        certificate.kind.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-(--ink-muted)">
                      {certificate.certificateNumber} ·{" "}
                      {new Date(certificate.issuedAt).toLocaleDateString(
                        "en-IN",
                        { dateStyle: "medium" },
                      )}
                    </p>
                  </div>
                </div>
                <Link href={`/certificates/${certificate._id}`} target="_blank">
                  <Button variant="outline" leftIcon={<Printer size={15} />}>
                    Preview / print
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<FileBadge size={24} />}
          title="No certificates issued"
          description="Issued promotion, program, and achievement certificates will be listed here."
        />
      )}
    </main>
  );
}
