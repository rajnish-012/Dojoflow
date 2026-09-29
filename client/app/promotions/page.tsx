"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Award,
  Check,
  CheckCircle2,
  History,
  Search,
  ShieldCheck,
  RefreshCw,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSpinner,
  Modal,
  PageHeader,
  SummaryCard,
} from "@/components/ui";

import {
  getEligiblePromotions,
  getStudentBeltHistory,
  promoteStudent,
  type BeltHistory,
  type EligiblePromotion,
} from "@/lib/promotionsApi";

/* ======================================================
   HELPERS
====================================================== */

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST"
  );
}

function formatDate(date?: string | null) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* ======================================================
   PAGE
====================================================== */

export default function PromotionsPage() {
  const [eligible, setEligible] = useState<EligiblePromotion[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");

  const [actionLoading, setActionLoading] = useState("");

  const [historyStudent, setHistoryStudent] =
    useState<EligiblePromotion | null>(null);

  const [history, setHistory] = useState<BeltHistory[]>([]);

  const [historyLoading, setHistoryLoading] = useState(false);

  const loadPromotions = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await getEligiblePromotions();

      setEligible(response.eligible || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Failed to load belt promotions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [success]);

  const filteredEligible = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return eligible;
    }

    return eligible.filter((item) => {
      const name = item.student.name.toLowerCase();

      const phone = item.student.phone?.toLowerCase() || "";

      const branch = item.branch.name.toLowerCase();

      const plan = item.plan.name.toLowerCase();

      const currentBelt = (item.student.currentBelt || "").toLowerCase();

      const nextBelt = item.milestone.belt.toLowerCase();

      const skill = (item.milestone.skill || "").toLowerCase();

      return (
        name.includes(query) ||
        phone.includes(query) ||
        branch.includes(query) ||
        plan.includes(query) ||
        currentBelt.includes(query) ||
        nextBelt.includes(query) ||
        skill.includes(query)
      );
    });
  }, [eligible, search]);

  const handlePromote = async (item: EligiblePromotion) => {
    const confirmed = window.confirm(
      `Promote ${item.student.name} from ${item.student.currentBelt || "White"} to ${item.milestone.belt} belt?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(item.student._id);

      setError("");
      setSuccess("");

      const response = await promoteStudent(item.student._id);

      setSuccess(
        response.message || `${item.student.name} promoted successfully.`,
      );

      await loadPromotions(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Failed to promote student.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const openHistory = async (item: EligiblePromotion) => {
    try {
      setHistoryStudent(item);

      setHistory([]);

      setHistoryLoading(true);

      const response = await getStudentBeltHistory(item.student._id);

      setHistory(response.history || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error ? err.message : "Failed to load belt history.",
      );

      setHistoryStudent(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    if (historyLoading) {
      return;
    }

    setHistoryStudent(null);

    setHistory([]);
  };

  if (loading) {
    return (
      <main>
        <div className="df-page">
          <LoadingSpinner
            fullPage
            size="lg"
            text="Loading belt promotions..."
          />
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Achievement management"
          title="Belt Promotions"
          description="
            Review students who have reached their belt milestones,
            approve promotions and view belt history.
          "
          actions={
            <Button
              variant="outline"
              size="lg"
              onClick={() => loadPromotions(true)}
              disabled={refreshing}
            >
              <RefreshCw size={18} />

              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          }
        />

        {error && (
          <div className="mt-5">
            <ErrorState title="Unable to load promotions" message={error} />
          </div>
        )}

        {success && (
          <div
            className="
              mt-5 flex items-center
              gap-3 rounded-xl
              border border-(--success)/20
              bg-(--success-soft)
              px-4 py-3
            "
          >
            <CheckCircle2 size={18} className="text-(--success)" />

            <p className="text-sm font-semibold text-(--success)">{success}</p>
          </div>
        )}

        <PromotionSummary
          eligible={eligible.length}
          visible={filteredEligible.length}
        />

        <Card padding="none" className="mt-6 overflow-hidden">
          {/* ==================================================
             SAME HEADER STRUCTURE AS STUDENTS
          ================================================== */}

          <div
            className="
              flex flex-col
              justify-between gap-5
              border-b border-(--line)
              px-5 py-5
              sm:px-6
              lg:flex-row
              lg:items-center
            "
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="
                    flex h-9 w-9
                    items-center
                    justify-center
                    rounded-xl
                    bg-(--accent-soft)
                    text-(--accent)
                  "
                >
                  <Award size={18} />
                </div>

                <div>
                  <h2
                    className="
                      text-xl font-extrabold
                      tracking-tight
                      text-(--foreground)
                    "
                  >
                    Promotion candidates
                  </h2>

                  <p
                    className="
                      mt-0.5 text-xs
                      text-(--ink-muted)
                      sm:text-sm
                    "
                  >
                    Students who have reached their configured belt milestone.
                  </p>
                </div>
              </div>
            </div>

            <div className="relative w-full lg:w-[340px]">
              <Search
                size={17}
                aria-hidden="true"
                className="
                  pointer-events-none
                  absolute left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students..."
                aria-label="Search promotion candidates"
                className="h-11 pl-10"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch("")}
                  className="
                    absolute right-2.5
                    top-1/2
                    flex h-7 w-7
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-lg
                    text-(--ink-faint)
                    transition
                    hover:bg-(--hover-bg)
                    hover:text-(--foreground)
                  "
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <PromotionTable
              items={filteredEligible}
              actionLoading={actionLoading}
              onPromote={handlePromote}
              onHistory={openHistory}
            />
          </div>

          <div className="space-y-3 p-4 md:hidden">
            <PromotionMobileList
              items={filteredEligible}
              total={eligible.length}
              actionLoading={actionLoading}
              onPromote={handlePromote}
              onHistory={openHistory}
            />
          </div>

          {filteredEligible.length > 0 && (
            <div
              className="
                border-t border-(--line)
                px-5 py-4
                sm:px-6
              "
            >
              <p
                className="
                  text-xs font-medium
                  text-(--ink-faint)
                "
              >
                Showing {filteredEligible.length} of {eligible.length} promotion
                candidates
              </p>
            </div>
          )}
        </Card>
      </div>

      <HistoryModal
        open={Boolean(historyStudent)}
        student={historyStudent}
        history={history}
        loading={historyLoading}
        onClose={closeHistory}
      />
    </main>
  );
}

/* ======================================================
   SUMMARY
====================================================== */

function PromotionSummary({
  eligible,
  visible,
}: {
  eligible: number;
  visible: number;
}) {
  return (
    <div
      className="
        grid gap-4
        sm:grid-cols-2
        xl:grid-cols-3
      "
    >
      <SummaryCard
        title="Eligible"
        value={eligible}
        subtitle="Students ready for review"
        icon={<Award size={20} />}
      />

      <SummaryCard
        title="Showing"
        value={visible}
        subtitle="Current search results"
        icon={<Search size={20} />}
      />

      <SummaryCard
        title="Approval"
        value="Admin"
        subtitle="Promotion requires approval"
        icon={<ShieldCheck size={20} />}
      />
    </div>
  );
}

/* ======================================================
   TABLE
====================================================== */

function PromotionTable({
  items,
  actionLoading,
  onPromote,
  onHistory,
}: {
  items: EligiblePromotion[];
  actionLoading: string;
  onPromote: (item: EligiblePromotion) => void;
  onHistory: (item: EligiblePromotion) => void;
}) {
  return (
    <table className="w-full min-w-[1150px]">
      <thead
        className="
          border-b border-(--line)
          bg-(--surface)
        "
      >
        <tr>
          <TableHeading>Student</TableHeading>

          <TableHeading>Current Belt</TableHeading>

          <TableHeading>Milestone</TableHeading>

          <TableHeading>Training</TableHeading>

          <TableHeading>Plan / Branch</TableHeading>

          <TableHeading align="right">Action</TableHeading>
        </tr>
      </thead>

      <tbody className="divide-y divide-(--line)">
        {items.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-6 py-8">
              <EmptyState
                title="No promotion candidates"
                description="
                  No students have reached a new belt milestone yet.
                "
                icon={<Award size={22} />}
              />
            </td>
          </tr>
        ) : (
          items.map((item) => (
            <PromotionTableRow
              key={item.student._id}
              item={item}
              actionLoading={actionLoading}
              onPromote={onPromote}
              onHistory={onHistory}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

/* ======================================================
   TABLE ROW
====================================================== */

function PromotionTableRow({
  item,
  actionLoading,
  onPromote,
  onHistory,
}: {
  item: EligiblePromotion;
  actionLoading: string;
  onPromote: (item: EligiblePromotion) => void;
  onHistory: (item: EligiblePromotion) => void;
}) {
  const name = item.student.name;

  const isLoading = actionLoading === item.student._id;

  return (
    <tr
      className="
        group
        transition-colors
        duration-200
        hover:bg-(--surface)
      "
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <PromotionAvatar name={name} />

          <div className="min-w-0">
            <p
              className="
                truncate text-sm
                font-bold
                text-(--foreground-soft)
                transition-colors
                group-hover:text-(--accent)
              "
            >
              {name}
            </p>

            <p
              className="
                mt-1 text-xs
                text-(--ink-muted)
              "
            >
              {item.student.phone || "No phone"}
            </p>
          </div>
        </div>
      </td>

      <td className="px-6 py-5">
        <Badge variant="default">
          {item.student.currentBelt || "White"} Belt
        </Badge>
      </td>

      <td className="px-6 py-5">
        <div>
          <p
            className="
              text-sm font-bold
              text-(--foreground-soft)
            "
          >
            {item.milestone.belt} Belt
          </p>

          <p
            className="
              mt-1 text-xs
              text-(--ink-muted)
            "
          >
            Day {item.milestone.day}
            {item.milestone.skill ? ` · ${item.milestone.skill}` : ""}
          </p>
        </div>
      </td>

      <td className="px-6 py-5">
        <div>
          <p
            className="
              text-sm font-bold
              text-(--foreground-soft)
            "
          >
            Day {item.trainingDay}
          </p>

          <p
            className="
              mt-1 text-xs
              text-(--ink-muted)
            "
          >
            Milestone reached
          </p>
        </div>
      </td>

      <td className="px-6 py-5">
        <p
          className="
            text-sm font-medium
            text-(--foreground-soft)
          "
        >
          {item.plan.name}
        </p>

        <p
          className="
            mt-1 text-xs
            text-(--ink-muted)
          "
        >
          {item.branch.name}
        </p>
      </td>

      <td className="px-6 py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isLoading}
            onClick={() => onHistory(item)}
          >
            <History size={15} />
            History
          </Button>

          <Button
            size="sm"
            variant="primary"
            loading={isLoading}
            onClick={() => onPromote(item)}
          >
            <Check size={15} />
            Promote
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ======================================================
   MOBILE
====================================================== */

function PromotionMobileList({
  items,
  total,
  actionLoading,
  onPromote,
  onHistory,
}: {
  items: EligiblePromotion[];
  total: number;
  actionLoading: string;
  onPromote: (item: EligiblePromotion) => void;
  onHistory: (item: EligiblePromotion) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No promotion candidates"
        description={
          total === 0
            ? "No students are currently eligible for a belt promotion."
            : "Try changing your search."
        }
        icon={<Award size={22} />}
      />
    );
  }

  return (
    <>
      {items.map((item) => (
        <PromotionMobileCard
          key={item.student._id}
          item={item}
          actionLoading={actionLoading}
          onPromote={onPromote}
          onHistory={onHistory}
        />
      ))}
    </>
  );
}

function PromotionMobileCard({
  item,
  actionLoading,
  onPromote,
  onHistory,
}: {
  item: EligiblePromotion;
  actionLoading: string;
  onPromote: (item: EligiblePromotion) => void;
  onHistory: (item: EligiblePromotion) => void;
}) {
  const isLoading = actionLoading === item.student._id;

  return (
    <div
      className="
        group
        rounded-2xl
        border border-(--line)
        bg-(--surface)
        p-4
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:border-(--line-strong)
        hover:bg-(--card)
        hover:shadow-[0_8px_25px_var(--shadow-color)]
      "
    >
      <div
        className="
          flex items-start
          justify-between gap-3
        "
      >
        <div className="flex min-w-0 items-center gap-3">
          <PromotionAvatar name={item.student.name} />

          <div className="min-w-0">
            <p
              className="
                truncate text-sm
                font-bold
                text-(--foreground-soft)
              "
            >
              {item.student.name}
            </p>

            <p
              className="
                mt-1 text-xs
                text-(--ink-muted)
              "
            >
              {item.student.phone || "No phone"}
            </p>
          </div>
        </div>

        <Badge variant="warning">Ready</Badge>
      </div>

      <div
        className="
          mt-4 grid
          grid-cols-2
          gap-x-4 gap-y-4
          border-t border-(--line)
          pt-4
        "
      >
        <MobileDetail
          label="Current"
          value={`${item.student.currentBelt || "White"} Belt`}
        />

        <MobileDetail label="Next" value={`${item.milestone.belt} Belt`} />

        <MobileDetail label="Training" value={`Day ${item.trainingDay}`} />

        <MobileDetail label="Milestone" value={`Day ${item.milestone.day}`} />

        <MobileDetail label="Plan" value={item.plan.name} />

        <MobileDetail label="Branch" value={item.branch.name} />
      </div>

      {item.milestone.skill && (
        <div
          className="
            mt-4 border-t
            border-(--line)
            pt-4
          "
        >
          <MobileDetail label="Skill" value={item.milestone.skill} />
        </div>
      )}

      <div
        className="
          mt-4 flex flex-wrap
          gap-2 border-t
          border-(--line)
          pt-4
        "
      >
        <Button
          size="sm"
          variant="outline"
          disabled={isLoading}
          onClick={() => onHistory(item)}
        >
          <History size={15} />
          History
        </Button>

        <Button
          size="sm"
          variant="primary"
          loading={isLoading}
          onClick={() => onPromote(item)}
        >
          <Check size={15} />
          Promote
        </Button>
      </div>
    </div>
  );
}

/* ======================================================
   AVATAR
====================================================== */

function PromotionAvatar({ name }: { name: string }) {
  return (
    <div
      className="
        flex h-10 w-10
        shrink-0
        items-center
        justify-center
        rounded-full
        border border-(--line)
        bg-(--sidebar-logo-bg)
        text-xs font-black
        text-(--gold)
      "
    >
      {getInitials(name)}
    </div>
  );
}

/* ======================================================
   HISTORY MODAL
====================================================== */

function HistoryModal({
  open,
  student,
  history,
  loading,
  onClose,
}: {
  open: boolean;
  student: EligiblePromotion | null;
  history: BeltHistory[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Belt history"
      description={
        student
          ? `${student.student.name} · Current belt: ${student.student.currentBelt || "White"}`
          : undefined
      }
      size="lg"
    >
      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <LoadingSpinner size="md" text="Loading belt history..." />
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          title="No belt history yet"
          description="
            Approved belt promotions will appear here.
          "
          icon={<History size={22} />}
        />
      ) : (
        <div className="space-y-3">
          {history.map((record) => (
            <div
              key={record._id}
              className="
                  rounded-2xl
                  border border-(--line)
                  bg-(--surface)
                  p-4
                "
            >
              <div
                className="
                    flex flex-col
                    gap-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                        flex h-10 w-10
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-(--accent-soft)
                        text-(--accent)
                      "
                  >
                    <Award size={19} />
                  </div>

                  <div>
                    <p
                      className="
                          text-sm
                          font-extrabold
                          text-(--foreground-soft)
                        "
                    >
                      {record.fromBelt || "White"} → {record.toBelt} Belt
                    </p>

                    <p
                      className="
                          mt-1 text-xs
                          text-(--ink-muted)
                        "
                    >
                      Day {record.milestoneDay} ·{" "}
                      {formatDate(record.promotedAt)}
                    </p>
                  </div>
                </div>

                <Badge variant="success">
                  <Check size={13} />
                  Approved
                </Badge>
              </div>

              {record.skill && (
                <p
                  className="
                      mt-4
                      text-sm font-semibold
                      text-(--foreground-soft)
                    "
                >
                  {record.skill}
                </p>
              )}

              {record.description && (
                <p
                  className="
                      mt-2 text-xs
                      leading-5
                      text-(--ink-muted)
                    "
                >
                  {record.description}
                </p>
              )}

              {record.approvedBy && (
                <p
                  className="
                      mt-4 text-[11px]
                      text-(--ink-faint)
                    "
                >
                  Approved by {record.approvedBy.name}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/* ======================================================
   TABLE HEADING
====================================================== */

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`
        px-6 py-4
        text-[10px]
        font-black
        uppercase
        tracking-[0.16em]
        text-(--ink-faint)
        ${align === "right" ? "text-right" : "text-left"}
      `}
    >
      {children}
    </th>
  );
}

/* ======================================================
   MOBILE DETAIL
====================================================== */

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        className="
          text-[9px]
          font-black
          uppercase
          tracking-[0.12em]
          text-(--ink-faint)
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1 truncate
          text-sm font-medium
          text-(--foreground-soft)
        "
      >
        {value}
      </p>
    </div>
  );
}
