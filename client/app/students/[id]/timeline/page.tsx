"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Target,
} from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingSpinner,
  PageHeader,
  SummaryCard,
} from "@/components/ui";

import TrainingTimeline from "@/components/student/TrainingTimeline";

import {
  getStudentTimeline,
  type StudentTimelineResponse,
} from "@/lib/studentTimelineApi";

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

export default function StudentTimelinePage() {
  const params = useParams();

  const studentId = String(
    params?.id || ""
  );

  const [data, setData] =
    useState<StudentTimelineResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!studentId) {
      return;
    }

    let cancelled = false;

    async function loadTimeline() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getStudentTimeline(
            studentId
          );

        if (!cancelled) {
          setData(response);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load training timeline."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const completedPercentage =
    useMemo(() => {
      if (!data?.summary.totalTrainingDays) {
        return 0;
      }

      return Math.min(
        100,
        Math.round(
          (data.summary.completedTrainingDay /
            data.summary.totalTrainingDays) *
            100
        )
      );
    }, [data]);

  if (loading) {
    return (
      <div className="df-page">
        <LoadingSpinner
          fullPage
          text="Loading training timeline..."
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="df-page">
        <ErrorState
          title="Unable to load timeline"
          message={
            error ||
            "Student timeline could not be loaded."
          }
        />
      </div>
    );
  }

  const {
    student,
    summary,
    timeline,
  } = data;

  return (
    <div className="df-page">
      <PageHeader
        eyebrow="Student journey"
        title={`${student.name}'s Training Timeline`}
        description="Track training days, curriculum milestones, attendance and upcoming belt progression."
        actions={
          <Link
            href={`/students/${student._id}`}
          >
            <Button variant="outline">
              <ArrowLeft size={17} />
              Back to Student
            </Button>
          </Link>
        }
      />

      {/* Student overview */}
      <Card>
        <div
          className="
            flex
            flex-col
            gap-5
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div className="min-w-0">
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  bg-[var(--gold-soft)]
                  text-[var(--gold-dark)]
                "
              >
                <GraduationCap
                  size={23}
                />
              </div>

              <div>
                <h2
                  className="
                    text-lg
                    font-bold
                    text-[var(--text-primary)]
                  "
                >
                  {student.name}
                </h2>

                <div
                  className="
                    mt-1
                    flex
                    flex-wrap
                    items-center
                    gap-x-3
                    gap-y-1
                    text-sm
                    text-[var(--text-secondary)]
                  "
                >
                  <span>
                    {student.plan.name}
                  </span>

                  <span className="text-[var(--line-strong)]">
                    •
                  </span>

                  <span>
                    Joined{" "}
                    {formatDate(
                      student.joinDate
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <Badge variant="warning">
              {student.currentBelt}
            </Badge>

            <Badge
              variant={
                student.status ===
                "ACTIVE"
                  ? "success"
                  : "default"
              }
            >
              {student.status}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div
        className="
          grid
          gap-4
          sm:grid-cols-2
          xl:grid-cols-4
        "
      >
        <SummaryCard
          title="Current Belt"
          value={summary.currentBelt}
          subtitle="Current student belt"
          icon={
            <GraduationCap
              size={20}
            />
          }
        />

        <SummaryCard
          title="Training Progress"
          value={`${completedPercentage}%`}
          subtitle={`${summary.completedTrainingDay} of ${summary.totalTrainingDays} days`}
          icon={
            <CheckCircle2
              size={20}
            />
          }
        />

        <SummaryCard
          title="Milestones"
          value={summary.totalMilestones}
          subtitle="Belt milestones in plan"
          icon={
            <Target size={20} />
          }
        />

        <SummaryCard
          title="Next Milestone"
          value={
            summary.nextMilestone
              ? `Day ${summary.nextMilestone.day}`
              : "Complete"
          }
          subtitle={
            summary.nextMilestone
              ? summary.nextMilestone.belt
              : "No upcoming milestone"
          }
          icon={
            <Clock3 size={20} />
          }
        />
      </div>

      {/* Next milestone */}
      {summary.nextMilestone && (
        <Card>
          <div
            className="
              flex
              flex-col
              gap-5
              md:flex-row
              md:items-center
              md:justify-between
            "
          >
            <div>
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.14em]
                  text-[var(--gold-dark)]
                "
              >
                <Target size={15} />

                Next belt milestone
              </div>

              <h2
                className="
                  mt-2
                  text-xl
                  font-bold
                  text-[var(--text-primary)]
                "
              >
                {summary.nextMilestone.belt}
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-[var(--text-secondary)]
                "
              >
                {summary.nextMilestone.skill ||
                  "Milestone assessment"}
              </p>
            </div>

            <div
              className="
                flex
                items-center
                gap-3
                rounded-xl
                border
                border-[var(--line)]
                bg-[var(--surface-muted)]
                px-4
                py-3
              "
            >
              <CalendarDays
                size={18}
                className="text-[var(--gold-dark)]"
              />

              <div>
                <p
                  className="
                    text-[11px]
                    font-bold
                    uppercase
                    tracking-[0.12em]
                    text-[var(--text-muted)]
                  "
                >
                  Expected date
                </p>

                <p
                  className="
                    mt-0.5
                    text-sm
                    font-bold
                    text-[var(--text-primary)]
                  "
                >
                  {formatDate(
                    summary.nextMilestone.date ||
                      undefined
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Timeline */}
      <div>
        <div
          className="
            mb-4
            flex
            flex-col
            gap-2
            sm:flex-row
            sm:items-end
            sm:justify-between
          "
        >
          <div>
            <h2
              className="
                text-lg
                font-bold
                text-[var(--text-primary)]
              "
            >
              Training Journey
            </h2>

            <p
              className="
                mt-1
                text-sm
                text-[var(--text-secondary)]
              "
            >
              Every curriculum day and belt
              milestone from admission onward.
            </p>
          </div>

          <div
            className="
              text-sm
              font-medium
              text-[var(--text-muted)]
            "
          >
            {timeline.length} timeline items
          </div>
        </div>

        <TrainingTimeline
          items={timeline}
        />
      </div>
    </div>
  );
}