"use client";

import {
  CalendarDays,
  Check,
  Circle,
  Clock3,
  Dumbbell,
  GraduationCap,
  RotateCcw,
  Target,
} from "lucide-react";

import {
  Badge,
  Card,
} from "@/components/ui";

import type {
  TrainingTimelineItem,
} from "@/lib/studentTimelineApi";

type TrainingTimelineProps = {
  items: TrainingTimelineItem[];
};

function formatDate(value: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

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

function getStatusVariant(
  status: TrainingTimelineItem["status"]
) {
  switch (status) {
    case "COMPLETED":
      return "success" as const;

    case "MAKEUP_COMPLETED":
      return "info" as const;

    case "MISSED":
      return "danger" as const;

    default:
      return "default" as const;
  }
}

function getStatusIcon(
  status: TrainingTimelineItem["status"]
) {
  switch (status) {
    case "COMPLETED":
      return (
        <Check
          size={15}
          strokeWidth={2.5}
        />
      );

    case "MAKEUP_COMPLETED":
      return (
        <RotateCcw
          size={15}
          strokeWidth={2.2}
        />
      );

    case "MISSED":
      return (
        <Clock3
          size={15}
          strokeWidth={2.2}
        />
      );

    default:
      return (
        <Circle
          size={15}
          strokeWidth={2}
        />
      );
  }
}

function TimelineMarker({
  item,
}: {
  item: TrainingTimelineItem;
}) {
  if (item.type === "MILESTONE") {
    return (
      <div
        className="
          relative
          z-10
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-[var(--gold)]
          bg-[var(--gold-soft)]
          text-[var(--gold-dark)]
          shadow-[var(--shadow-sm)]
        "
      >
        <GraduationCap
          size={21}
        />
      </div>
    );
  }

  if (
    item.status === "COMPLETED" ||
    item.status === "MAKEUP_COMPLETED"
  ) {
    return (
      <div
        className="
          relative
          z-10
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-[var(--success)]
          bg-[var(--success-soft)]
          text-[var(--success)]
          shadow-[var(--shadow-sm)]
        "
      >
        <Check
          size={20}
          strokeWidth={2.6}
        />
      </div>
    );
  }

  if (item.status === "MISSED") {
    return (
      <div
        className="
          relative
          z-10
          flex
          h-12
          w-12
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          border-[var(--danger)]
          bg-[var(--danger-soft)]
          text-[var(--danger)]
        "
      >
        <Clock3 size={19} />
      </div>
    );
  }

  return (
    <div
      className="
        relative
        z-10
        flex
        h-12
        w-12
        shrink-0
        items-center
        justify-center
        rounded-full
        border
        border-[var(--line)]
        bg-[var(--surface)]
        text-[var(--text-muted)]
      "
    >
      <Circle size={17} />
    </div>
  );
}

function TimelineCard({
  item,
}: {
  item: TrainingTimelineItem;
}) {
  const isMilestone =
    item.type === "MILESTONE";

  return (
    <div
      className={`
        relative
        rounded-2xl
        border
        p-5
        transition-all
        duration-200
        ${
          isMilestone
            ? "border-[var(--gold)] bg-[var(--gold-soft)]/40"
            : "border-[var(--line)] bg-[var(--surface)]"
        }
      `}
    >
      <div
        className="
          flex
          flex-col
          gap-4
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div className="min-w-0">
          <div
            className="
              mb-2
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <span
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.12em]
                text-[var(--text-muted)]
              "
            >
              Day {item.day}
            </span>

            {isMilestone && (
              <Badge variant="warning">
                Belt milestone
              </Badge>
            )}
          </div>

          <h3
            className="
              text-base
              font-bold
              text-[var(--text-primary)]
            "
          >
            {item.title}
          </h3>

          {item.skill && (
            <div
              className="
                mt-2
                flex
                items-center
                gap-2
                text-sm
                font-medium
                text-[var(--gold-dark)]
              "
            >
              <Target size={15} />

              <span>
                {item.skill}
              </span>
            </div>
          )}

          {item.description && (
            <p
              className="
                mt-2
                max-w-2xl
                text-sm
                leading-6
                text-[var(--text-secondary)]
              "
            >
              {item.description}
            </p>
          )}
        </div>

        <div
          className="
            flex
            shrink-0
            flex-col
            items-start
            gap-2
            sm:items-end
          "
        >
          <div
            className="
              flex
              items-center
              gap-1.5
              text-xs
              font-medium
              text-[var(--text-muted)]
            "
          >
            <CalendarDays size={14} />

            {formatDate(item.date)}
          </div>

          <Badge
            variant={getStatusVariant(
              item.status
            )}
          >
            <span
              className="
                mr-1.5
                inline-flex
                align-middle
              "
            >
              {getStatusIcon(item.status)}
            </span>

            {item.statusLabel}
          </Badge>
        </div>
      </div>

      {item.milestone && (
        <div
          className="
            mt-5
            flex
            flex-col
            gap-2
            rounded-xl
            border
            border-[var(--gold)]/30
            bg-[var(--surface)]
            p-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <p
              className="
                text-[11px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-[var(--gold-dark)]
              "
            >
              Target belt
            </p>

            <p
              className="
                mt-1
                text-sm
                font-bold
                text-[var(--text-primary)]
              "
            >
              {item.milestone.belt}
            </p>
          </div>

          <div>
            <p
              className="
                text-[11px]
                font-bold
                uppercase
                tracking-[0.14em]
                text-[var(--text-muted)]
              "
            >
              Milestone day
            </p>

            <p
              className="
                mt-1
                text-sm
                font-semibold
                text-[var(--text-primary)]
              "
            >
              Day {item.milestone.day}
            </p>
          </div>
        </div>
      )}

      {item.makeup && (
        <div
          className="
            mt-4
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-[var(--info)]/20
            bg-[var(--info-soft)]
            px-4
            py-3
            text-sm
            text-[var(--text-secondary)]
          "
        >
          <RotateCcw
            size={16}
            className="shrink-0"
          />

          <span>
            Makeup status:{" "}
            <strong>
              {item.makeup.status}
            </strong>
          </span>
        </div>
      )}
    </div>
  );
}

export default function TrainingTimeline({
  items,
}: TrainingTimelineProps) {
  if (!items.length) {
    return (
      <Card>
        <div
          className="
            flex
            min-h-56
            flex-col
            items-center
            justify-center
            text-center
          "
        >
          <div
            className="
              mb-4
              flex
              h-12
              w-12
              items-center
              justify-center
              rounded-full
              bg-[var(--surface-muted)]
              text-[var(--text-muted)]
            "
          >
            <Dumbbell size={22} />
          </div>

          <h3
            className="
              text-base
              font-bold
              text-[var(--text-primary)]
            "
          >
            No training timeline yet
          </h3>

          <p
            className="
              mt-1
              max-w-md
              text-sm
              text-[var(--text-secondary)]
            "
          >
            This student's plan does not
            contain any curriculum or
            milestone days yet.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="p-5 sm:p-6">
        <div
          className="
            relative
            space-y-5
          "
        >
          <div
            className="
              absolute
              bottom-6
              left-[23px]
              top-6
              w-px
              bg-[var(--line)]
            "
          />

          {items.map((item) => (
            <div
              key={`${item.type}-${item.day}`}
              className="
                relative
                flex
                gap-4
                sm:gap-5
              "
            >
              <TimelineMarker
                item={item}
              />

              <div className="min-w-0 flex-1">
                <TimelineCard
                  item={item}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}