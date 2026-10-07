"use client";

import { fetchWithSession } from "@/lib/sessionFetch";
import { confirmAction, toast } from "@/lib/toast";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  CalendarOff,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ErrorState,
  IconButton,
  Input,
  LoadingSpinner,
  PageHeader,
  Select,
  TablePagination,
  TableHeading,
  Textarea,
} from "@/components/ui";

import {
  createHoliday,
  deleteHoliday,
  getHolidays,
  updateHoliday,
  type Holiday,
} from "@/lib/holidayApi";
import { PERMISSIONS, useCan } from "@/lib/permissions";

/* ==========================================
   TYPES
========================================== */

type Branch = {
  _id: string;
  name: string;
  address?: string;
  status?: string;
  isActive?: boolean;
};

/* ==========================================
   HELPERS
========================================== */

function getLocalDate() {
  const date = new Date();

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateInputValue(
  value?: string | null,
) {
  if (!value) {
    return getLocalDate();
  }

  const trimmed =
    String(value).trim();

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      trimmed,
    )
  ) {
    return trimmed;
  }

  const date = new Date(
    trimmed,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return getLocalDate();
  }

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string,
) {
  if (!value) {
    return "—";
  }

  const dateValue =
    getDateInputValue(value);

  return new Date(
    `${dateValue}T00:00:00`,
  ).toLocaleDateString(
    "en-IN",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function isPastDate(
  value: string,
) {
  if (!value) {
    return false;
  }

  return (
    value < getLocalDate()
  );
}

function getBranchName(
  holiday: Holiday,
) {
  if (!holiday.branch) {
    return "All branches";
  }

  if (
    typeof holiday.branch ===
    "string"
  ) {
    return "Branch";
  }

  return (
    holiday.branch.name ||
    "Branch"
  );
}

/* ==========================================
   PAGE
========================================== */

export default function HolidaysPage() {
  const canViewHolidays = useCan(PERMISSIONS.HOLIDAY_VIEW);
  const canManageHolidays = useCan(PERMISSIONS.HOLIDAY_MANAGE);
  const [holidays, setHolidays] =
    useState<Holiday[]>([]);

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [branchesLoading, setBranchesLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showForm, setShowForm] =
    useState(false);

  const [
    editingHoliday,
    setEditingHoliday,
  ] = useState<Holiday | null>(
    null,
  );

  const [saving, setSaving] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null,
  );

  const [formError, setFormError] =
    useState("");

  const [form, setForm] =
    useState({
      date: getLocalDate(),
      name: "",
      description: "",
      branch: "",
    });

  /* ==========================================
     LOAD HOLIDAYS
  ========================================== */

  const loadHolidays =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getHolidays();

        setHolidays(
          data.holidays ||
            data.data?.holidays ||
            [],
        );
      } catch (err) {
        console.error(
          "Load holidays error:",
          err,
        );

        setHolidays([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load holidays.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  /* ==========================================
     LOAD BRANCHES
  ========================================== */

  const loadBranches =
    useCallback(async () => {
      try {
        setBranchesLoading(
          true,
        );

        const API_URL =
          process.env
            .NEXT_PUBLIC_API_URL ||
          "http://localhost:5000/api";

        const response =
          await fetchWithSession(
            `${API_URL}/branches`,
            {
              method: "GET",
              headers: {
                "Content-Type":
                  "application/json",
              },
              cache: "no-store",
            },
          );

        const text =
          await response.text();

        let data: any = {};

        try {
          data = text
            ? JSON.parse(text)
            : {};
        } catch {
          throw new Error(
            "Invalid branches API response.",
          );
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load branches.",
          );
        }

        /*
         * Normalize the branches response.
         *
         * Different API response shapes are
         * supported:
         *
         * 1. { branches: [...] }
         * 2. { data: { branches: [...] } }
         * 3. { branch: {...} }
         *
         * We also support both:
         *
         * _id
         * id
         *
         * Invalid and duplicate branch
         * records are ignored.
         */
        const rawBranches =
          data.branches ||
          data.data?.branches ||
          [];

        const normalizedBranches: Branch[] = [];

        const seenBranchIds =
          new Set<string>();

        for (const item of Array.isArray(
          rawBranches,
        )
          ? rawBranches
          : []) {
          const branch =
            item?.branch || item;

          const branchId = String(
            branch?._id ||
              branch?.id ||
              "",
          ).trim();

          const branchName = String(
            branch?.name || "",
          ).trim();

          if (
            !branchId ||
            !branchName ||
            seenBranchIds.has(
              branchId,
            )
          ) {
            continue;
          }

          seenBranchIds.add(
            branchId,
          );

          normalizedBranches.push({
            _id: branchId,

            name: branchName,

            address:
              branch?.address || "",

            status:
              branch?.status,

            isActive:
              branch?.isActive !== false,
          });
        }

        setBranches(
          normalizedBranches,
        );
      } catch (err) {
        console.error(
          "Load branches error:",
          err,
        );

        /*
         * Do not block the holiday page
         * if branches fail to load.
         *
         * Global holiday is still available.
         */
        setBranches([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load branches.",
        );
      } finally {
        setBranchesLoading(
          false,
        );
      }
    }, []);

  useEffect(() => {
    loadHolidays();
    loadBranches();
  }, [
    loadHolidays,
    loadBranches,
  ]);

  /* ==========================================
     FILTER HOLIDAYS
  ========================================== */

  const filteredHolidays =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return holidays;
      }

      return holidays.filter(
        (holiday) => {
          return (
            holiday.name
              ?.toLowerCase()
              .includes(query) ||
            holiday.description
              ?.toLowerCase()
              .includes(query) ||
            getBranchName(
              holiday,
            )
              .toLowerCase()
              .includes(query) ||
            getDateInputValue(
              holiday.date,
            )
              .toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      holidays,
      search,
    ]);

  const totalPages = Math.max(1, Math.ceil(filteredHolidays.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const visibleHolidays = filteredHolidays.slice((page - 1) * pageSize, page * pageSize);

  /* ==========================================
     OPEN CREATE
  ========================================== */

  function openCreate() {
    if (!canManageHolidays) {
      return;
    }
    setEditingHoliday(null);

    setForm({
      date: getLocalDate(),
      name: "",
      description: "",
      branch: "",
    });

    setFormError("");
    setShowForm(true);
  }

  /* ==========================================
     OPEN EDIT
  ========================================== */

  function openEdit(
    holiday: Holiday,
  ) {
    if (!canManageHolidays) {
      return;
    }
    setEditingHoliday(
      holiday,
    );

    let branchValue = "";

    if (
      holiday.branch &&
      typeof holiday.branch !==
        "string"
    ) {
      branchValue =
        holiday.branch._id;
    } else if (
      typeof holiday.branch ===
      "string"
    ) {
      branchValue =
        holiday.branch;
    }

    setForm({
      date:
        getDateInputValue(
          holiday.date,
        ),
      name:
        holiday.name || "",
      description:
        holiday.description ||
        "",
      branch:
        branchValue,
    });

    setFormError("");
    setShowForm(true);
  }

  /* ==========================================
     CLOSE FORM
  ========================================== */

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingHoliday(null);
    setFormError("");
  }

  /* ==========================================
     SAVE
  ========================================== */

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    if (!canManageHolidays) {
      toast.error("You do not have permission to perform this action.");
      return;
    }
    event.preventDefault();

    setFormError("");

    const today =
      getLocalDate();

    if (!form.date) {
      setFormError(
        "Please select a holiday date.",
      );

      return;
    }

    /*
     * New holidays can only be
     * created from today onward.
     */
    if (
      !editingHoliday &&
      form.date < today
    ) {
      setFormError(
        "You can only create a holiday from today onward. Past dates are not allowed.",
      );

      return;
    }

    /*
     * A past holiday may still be edited,
     * but its date cannot be moved.
     */
    if (
      editingHoliday &&
      isPastDate(
        getDateInputValue(
          editingHoliday.date,
        ),
      ) &&
      form.date !==
        getDateInputValue(
          editingHoliday.date,
        )
    ) {
      setFormError(
        "A past holiday cannot be moved to another date.",
      );

      return;
    }

    if (!form.name.trim()) {
      setFormError(
        "Please enter the holiday name.",
      );

      return;
    }

    try {
      setSaving(true);

      /*
       * Empty branch means:
       *
       * GLOBAL HOLIDAY
       *
       * The backend stores this as:
       * branch: null
       */
      const payload = {
        date: form.date,
        name: form.name.trim(),
        description:
          form.description.trim(),
        branch:
          form.branch || null,
      };

      if (editingHoliday) {
        await updateHoliday(
          editingHoliday._id,
          payload,
        );
      } else {
        await createHoliday(
          payload,
        );
      }

      closeForm();

      await loadHolidays();
      toast.success(editingHoliday ? "Holiday updated successfully." : "Holiday created successfully.");
    } catch (err) {
      console.error(
        "Save holiday error:",
        err,
      );

      toast.error(err instanceof Error ? err.message : "Failed to save holiday.");
    } finally {
      setSaving(false);
    }
  }

  /* ==========================================
     DELETE
  ========================================== */

  async function handleDelete(
    holiday: Holiday,
  ) {
    if (!canManageHolidays) {
      toast.error("You do not have permission to perform this action.");
      return;
    }
    const confirmed = await confirmAction({ title: "Delete holiday?", message: `Delete "${holiday.name}" on ${formatDate(holiday.date)}?`, confirmLabel: "Delete holiday", destructive: true });

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        holiday._id,
      );

      await deleteHoliday(
        holiday._id,
      );

      await loadHolidays();
    } catch (err) {
      console.error(
        "Delete holiday error:",
        err,
      );

      toast.error(err instanceof Error ? err.message : "Failed to delete holiday.");
      return;
    } finally {
      setDeletingId(null);
    }
    toast.success("Holiday deleted successfully.");
  }

  /* ==========================================
     DATE RULES
  ========================================== */

  const today =
    getLocalDate();

  const editingPastHoliday =
    Boolean(
      editingHoliday &&
        isPastDate(
          getDateInputValue(
            editingHoliday.date,
          ),
        ),
    );

  const dateFieldDisabled =
    saving ||
    editingPastHoliday;

  if (!canViewHolidays) {
    return (
      <main className="df-page">
        <PageHeader
          eyebrow="Authorization"
          title="Holidays"
          description="Your role does not include permission to manage holidays."
        />
      </main>
    );
  }

  /* ==========================================
     RENDER
  ========================================== */

  return (
    <main>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy calendar"
          title="Holidays"
          description="Manage academy holidays and branch-specific non-training days."
          actions={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={
                  loadHolidays
                }
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={
                    loading
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh
              </Button>

              {canManageHolidays && <Button
                type="button"
                onClick={
                  openCreate
                }
              >
                <Plus size={16} />

                Add holiday
              </Button>}
            </div>
          }
        />

        {/* ======================================
            ERROR
        ====================================== */}

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Holiday notice"
              message={error}
              action={
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError("");
                    loadHolidays();
                    loadBranches();
                  }}
                >
                  Try again
                </Button>
              }
            />
          </div>
        )}

        {/* ======================================
            SEARCH
        ====================================== */}

        <Card padding="md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                  <CalendarOff
                    size={18}
                  />
                </div>

                <div>
                  <h2 className="text-lg font-extrabold text-(--foreground)">
                    Academy holidays
                  </h2>

                  <p className="mt-0.5 text-xs text-(--ink-muted) sm:text-sm">
                    {holidays.length}{" "}
                    holiday
                    {holidays.length ===
                    1
                      ? ""
                      : "s"}{" "}
                    configured
                  </p>
                </div>
              </div>
            </div>

            <div className="relative w-full sm:max-w-sm">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--ink-faint)"
              />

              <Input
                value={search}
                onChange={(
                  event,
                ) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }
                }
                placeholder="Search holidays..."
                className="pl-10"
              />
            </div>
          </div>
        </Card>

        {/* ======================================
            FORM
        ====================================== */}

        {showForm && canManageHolidays && (
          <Card
            padding="md"
            className="mt-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                    <CalendarDays
                      size={18}
                    />
                  </div>

                  <div>
                    <h2 className="text-lg font-extrabold text-(--foreground)">
                      {editingHoliday
                        ? "Edit holiday"
                        : "Add holiday"}
                    </h2>

                    <p className="mt-0.5 text-xs text-(--ink-muted)">
                      Holidays do not create
                      attendance records or
                      consume training days.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={
                  closeForm
                }
                disabled={saving}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--ink-muted) transition-colors hover:bg-(--hover-bg) hover:text-(--foreground)"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="mt-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                {/* DATE */}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-(--foreground-soft)">
                    Holiday date
                  </span>

                  <input
                    type="date"
                    value={
                      form.date
                    }
                    min={today}
                    disabled={
                      dateFieldDisabled
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          date:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    className="df-input w-full disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  />

                  {editingPastHoliday ? (
                    <p className="mt-2 text-xs font-medium text-(--ink-muted)">
                      This is a historical
                      holiday. Its date cannot
                      be changed.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-(--ink-muted)">
                      You can only configure
                      holidays for today or a
                      future date.
                    </p>
                  )}
                </label>

                {/* NAME */}

                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-(--foreground-soft)">
                    Holiday name
                  </span>

                  <Input
                    value={
                      form.name
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          name:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="e.g. Independence Day"
                    required
                  />
                </label>

                {/* DESCRIPTION */}

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-bold text-(--foreground-soft)">
                    Description
                  </span>

                  <Textarea
                    value={
                      form.description
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          description:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Optional holiday description"
                    rows={3}
                    className="resize-y"
                  />
                </label>

                {/* BRANCH */}

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-xs font-bold text-(--foreground-soft)">
                    Holiday scope
                  </span>

                  <Select
                    value={
                      form.branch
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm(
                        (
                          current,
                        ) => ({
                          ...current,
                          branch:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    disabled={
                      saving ||
                      branchesLoading
                    }
                    className="df-input w-full disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      All Branches
                    </option>

                    {branches.map(
                      (branch) => (
                        <option
                          key={`holiday-branch-${branch._id}`}
                          value={
                            branch._id
                          }
                        >
                          {
                            branch.name
                          }
                        </option>
                      ),
                    )}
                  </Select>

                  <p className="mt-2 text-xs text-(--ink-muted)">
                    <strong>
                      All Branches
                    </strong>{" "}
                    means this holiday applies
                    to every academy branch.
                    Select a branch to make the
                    holiday branch-specific.
                  </p>

                  {!branchesLoading &&
                    branches.length ===
                      0 && (
                      <p className="mt-2 text-xs font-medium text-(--danger)">
                        No branches were loaded.
                        All Branches is still
                        available.
                      </p>
                    )}
                </label>
              </div>

              {/* FORM ERROR */}

              {formError && (
                <div className="mt-5 rounded-xl border border-(--danger-soft) bg-(--danger-soft) px-4 py-3 text-sm font-medium text-(--danger)">
                  {formError}
                </div>
              )}

              {/* ACTIONS */}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    closeForm
                  }
                  disabled={saving}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={
                    saving ||
                    branchesLoading
                  }
                >
                  {saving ? (
                    <LoadingSpinner
                      size="sm"
                    />
                  ) : (
                    <CalendarDays
                      size={16}
                    />
                  )}

                  {editingHoliday
                    ? "Update holiday"
                    : "Create holiday"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* ======================================
            HOLIDAY LIST
        ====================================== */}

        <Card
          padding="none"
          className="mt-6 overflow-hidden"
        >
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center px-5 py-12">
              <LoadingSpinner
                size="md"
                text="Loading holidays..."
              />
            </div>
          ) : filteredHolidays.length ===
            0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--accent-soft) text-(--accent)">
                <CalendarOff
                  size={22}
                />
              </div>

              <h3 className="mt-4 text-base font-bold text-(--foreground)">
                No holidays found
              </h3>

              <p className="mt-1 max-w-sm text-sm text-(--ink-muted)">
                {search
                  ? "Try a different search term."
                  : "No holidays have been configured yet."}
              </p>

              {!search && canManageHolidays && (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={
                    openCreate
                  }
                  disabled={!canManageHolidays}
                >
                  <Plus
                    size={15}
                  />

                  Add holiday
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px]">
                  <thead className="border-b border-(--line) bg-(--surface)">
                    <tr>
                      <TableHeading>
                        Date
                      </TableHeading>

                      <TableHeading>
                        Holiday
                      </TableHeading>

                      <TableHeading>
                        Scope
                      </TableHeading>

                      <TableHeading>
                        Status
                      </TableHeading>

                      {canManageHolidays && (
                        <TableHeading align="right">Actions</TableHeading>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-(--line)">
                    {visibleHolidays.map(
                      (
                        holiday,
                      ) => (
                        <tr
                          key={
                            holiday._id
                          }
                          className="transition-colors hover:bg-(--surface)"
                        >
                          {canManageHolidays && <td className="px-6 py-5">
                            <p className="text-[15px] font-semibold leading-5 text-(--foreground-soft)">
                              {formatDate(
                                holiday.date,
                              )}
                            </p>

                            <p className="mt-1 text-sm leading-5 text-(--ink-muted)">
                              {getDateInputValue(
                                holiday.date,
                              )}
                            </p>
                          </td>}

                          <td className="px-6 py-5">
                            <p className="text-[15px] font-semibold leading-5 text-(--foreground-soft)">
                              {
                                holiday.name
                              }
                            </p>

                            {holiday.description && (
                              <p className="mt-1 max-w-[320px] truncate text-sm leading-5 text-(--ink-muted)">
                                {
                                  holiday.description
                                }
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <Badge variant="default">
                              {getBranchName(
                                holiday,
                              )}
                            </Badge>
                          </td>

                          <td className="px-6 py-5">
                            {holiday.isActive ? (
                              <Badge variant="success">
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="default">
                                Inactive
                              </Badge>
                            )}
                          </td>

                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2">
                              <IconButton
                                type="button"
                                label={`Edit ${holiday.name}`}
                                onClick={() =>
                                  openEdit(
                                    holiday,
                                  )
                                }
                                disabled={!canManageHolidays}
                              >
                                <Edit3 size={16} />
                              </IconButton>

                              <IconButton
                                type="button"
                                variant="danger"
                                label={`Delete ${holiday.name}`}
                                disabled={
                                  !canManageHolidays || deletingId ===
                                  holiday._id
                                }
                                onClick={() =>
                                  handleDelete(
                                    holiday,
                                  )
                                }
                              >
                                {deletingId ===
                                holiday._id ? (
                                  <LoadingSpinner
                                    size="sm"
                                  />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}

              <div className="space-y-3 p-4 md:hidden">
                {visibleHolidays.map(
                  (
                    holiday,
                  ) => (
                    <div
                      key={
                        holiday._id
                      }
                      className="rounded-2xl border border-(--line) bg-(--surface) p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                            <CalendarOff
                              size={
                                18
                              }
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-(--foreground-soft)">
                              {
                                holiday.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-(--ink-muted)">
                              {formatDate(
                                holiday.date,
                              )}
                            </p>
                          </div>
                        </div>

                        {holiday.isActive ? (
                          <Badge variant="success">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="default">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      {holiday.description && (
                        <p className="mt-4 text-sm leading-6 text-(--ink-muted)">
                          {
                            holiday.description
                          }
                        </p>
                      )}

                      <div className="mt-4 border-t border-(--line) pt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-(--ink-faint)">
                          Scope
                        </p>

                        <p className="mt-1 text-sm font-medium text-(--foreground-soft)">
                          {getBranchName(
                            holiday,
                          )}
                        </p>
                      </div>

                      {canManageHolidays && <div className="mt-4 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            openEdit(
                              holiday,
                            )
                          }
                          disabled={!canManageHolidays}
                        >
                          <Edit3
                            size={
                              14
                            }
                          />

                          Edit
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          className="flex-1"
                          disabled={
                            !canManageHolidays || deletingId ===
                            holiday._id
                          }
                          onClick={() =>
                            handleDelete(
                              holiday,
                            )
                          }
                        >
                          {deletingId ===
                          holiday._id ? (
                            <LoadingSpinner
                              size="sm"
                            />
                          ) : (
                            <Trash2
                              size={
                                14
                              }
                            />
                          )}

                          Delete
                        </Button>
                      </div>}
                    </div>
                  ),
                )}
              </div>
            </>
          )}
          <TablePagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredHolidays.length}
            visibleItems={visibleHolidays.length}
            pageSize={pageSize}
            entityLabel="holidays"
            onPrevious={() => setCurrentPage((value) => Math.max(1, value - 1))}
            onNext={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
            onPageSizeChange={(value) => { setPageSize(value); setCurrentPage(1); }}
          />
        </Card>
      </div>
    </main>
  );
}

/* ==========================================
   TABLE HEADING
========================================== */

