import { AlertCircle, CalendarCheck2, CheckCircle2, Users } from "lucide-react";

import { SummaryCard } from "@/components/ui";

type AttendanceStatsProps = {
  total: number;
  present: number;
  absent: number;
  pendingMakeups: number;
};

export default function AttendanceStats({
  total,
  present,
  absent,
  pendingMakeups,
}: AttendanceStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        title="Students"
        value={total}
        subtitle="Active students"
        icon={<Users size={20} />}
      />

      <SummaryCard
        title="Present"
        value={present}
        subtitle="Marked today"
        icon={<CheckCircle2 size={20} />}
      />

      <SummaryCard
        title="Absent"
        value={absent}
        subtitle="Marked today"
        icon={<CalendarCheck2 size={20} />}
      />

      <SummaryCard
        title="Pending makeups"
        value={pendingMakeups}
        subtitle="Needs follow-up"
        icon={<AlertCircle size={20} />}
      />
    </div>
  );
}
