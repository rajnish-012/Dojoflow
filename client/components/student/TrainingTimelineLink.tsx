"use client";

import {
  ArrowRight,
  CalendarRange,
} from "lucide-react";

import Link from "next/link";

type TrainingTimelineLinkProps = {
  studentId: string;
};

export default function TrainingTimelineLink({
  studentId,
}: TrainingTimelineLinkProps) {
  return (
    <Link
      href={`/students/${studentId}/timeline`}
      className="
        group
        flex
        w-full
        items-center
        justify-between
        rounded-2xl
        border
        border-[var(--line)]
        bg-[var(--surface)]
        p-5
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:border-[var(--gold)]
        hover:shadow-[var(--shadow-md)]
        sm:p-6
      "
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-[var(--gold-soft)]
            text-[var(--gold-dark)]
          "
        >
          <CalendarRange size={21} />
        </div>

        <div className="min-w-0">
          <h3
            className="
              text-sm
              font-bold
              text-[var(--text-primary)]
              sm:text-base
            "
          >
            Training Timeline
          </h3>

          <p
            className="
              mt-1
              text-xs
              leading-5
              text-[var(--text-secondary)]
              sm:text-sm
            "
          >
            View curriculum days, attendance,
            makeups and upcoming belt milestones.
          </p>
        </div>
      </div>

      <ArrowRight
        size={19}
        className="
          ml-4
          shrink-0
          text-[var(--text-muted)]
          transition-transform
          duration-200
          group-hover:translate-x-1
          group-hover:text-[var(--gold-dark)]
        "
      />
    </Link>
  );
}