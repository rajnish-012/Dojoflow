"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  Building2,
  Check,
  CheckCircle2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
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

import { createBranch, getBranches } from "@/lib/api";
import { useCan } from "@/lib/permissions";

type Branch = {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  isActive: boolean;
};

type BranchForm = {
  name: string;
  address: string;
  phone: string;
};

const initialForm: BranchForm = {
  name: "",
  address: "",
  phone: "",
};

export default function BranchesPage() {
  const canManageBranches = useCan("branch.manage");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState<BranchForm>(initialForm);

  const loadBranches = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const result = await getBranches();
      setBranches(result.branches || []);
    } catch (caughtError) {
      console.error(caughtError);

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to load branches.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadBranches();
  }, []);

  const openForm = () => {
    setForm(initialForm);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;

    setShowForm(false);
    setForm(initialForm);
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = form.name.trim();
    const address = form.address.trim();
    const phone = form.phone.trim();

    if (!name || !address) {
      setFormError("Please enter the branch name and complete address.");
      return;
    }

    try {
      setSubmitting(true);
      setFormError("");
      setError("");

      await createBranch({
        name,
        address,
        phone,
      });

      setShowForm(false);
      setForm(initialForm);

      await loadBranches();
    } catch (caughtError) {
      console.error(caughtError);

      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create branch.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return branches;

    return branches.filter((branch) => {
      return (
        branch.name.toLowerCase().includes(query) ||
        branch.address.toLowerCase().includes(query) ||
        Boolean(branch.phone?.toLowerCase().includes(query))
      );
    });
  }, [branches, search]);

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.isActive).length,
    [branches],
  );

  const inactiveBranches = branches.length - activeBranches;

  return (
    <div>
      <div className="df-page">
        <PageHeader
          eyebrow="Academy Management"
          title="Branch Management"
          description="Create and manage your academy branches, locations, and operational details."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void loadBranches(true)}
                disabled={loading || refreshing}
              >
                <RefreshCw
                  size={17}
                  className={refreshing ? "animate-spin" : ""}
                />
                Refresh
              </Button>

              {canManageBranches && (
                <Button variant="primary" onClick={openForm}>
                  <Plus size={18} />
                  Add Branch
                </Button>
              )}
            </div>
          }
        />

        {error && (
          <div className="mb-6">
            <ErrorState
              title="Unable to load branches"
              message={error}
              action={
                <Button
                  variant="secondary"
                  onClick={() => void loadBranches(true)}
                  disabled={refreshing}
                >
                  <RefreshCw
                    size={16}
                    className={refreshing ? "animate-spin" : ""}
                  />
                  Try again
                </Button>
              }
            />
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total Branches"
            value={branches.length}
            subtitle="All academy locations"
            icon={<Building2 size={20} />}
          />

          <SummaryCard
            title="Active Branches"
            value={activeBranches}
            subtitle="Currently operational"
            icon={<CheckCircle2 size={20} />}
          />

          <SummaryCard
            title="Inactive Branches"
            value={inactiveBranches}
            subtitle="Currently unavailable"
            icon={<Building2 size={20} />}
          />
        </div>

        <Card padding="none">
          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-(--line)
              px-5
              py-5
              sm:px-6
              lg:flex-row
              lg:items-center
              lg:justify-between
            "
          >
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold tracking-tight text-(--foreground)">
                  Branch Directory
                </h2>

                <Badge variant="neutral">{branches.length}</Badge>
              </div>

              <p className="mt-1 text-sm text-(--ink-muted)">
                View your academy locations and their operational status.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search
                size={17}
                className="
                  pointer-events-none
                  absolute
                  left-3.5
                  top-1/2
                  -translate-y-1/2
                  text-(--ink-faint)
                "
              />

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search branches..."
                className="pl-10"
                aria-label="Search branches"
              />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <LoadingSpinner text="Loading branches..." />
              </div>
            ) : filteredBranches.length === 0 ? (
              <EmptyState
                icon={<Building2 size={26} />}
                title={
                  search
                    ? "No matching branches found"
                    : "No branches created yet"
                }
                description={
                  search
                    ? "Try another branch name, address, or phone number."
                    : "Create your first branch using the Add Branch button."
                }
                action={
                  !search && canManageBranches ? (
                    <Button variant="primary" onClick={openForm}>
                      <Plus size={17} />
                      Create First Branch
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredBranches.map((branch) => (
                  <BranchCard key={branch._id} branch={branch} />
                ))}
              </div>
            )}
          </div>

          {!loading && filteredBranches.length > 0 && (
            <div
              className="
                border-t
                border-(--line)
                px-5
                py-4
                sm:px-6
              "
            >
              <p className="text-xs font-medium text-(--ink-faint)">
                Showing {filteredBranches.length} of {branches.length} branches
              </p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={closeForm}
        title="Create New Branch"
        description="Add the details of your new academy branch."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeForm}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              form="create-branch-form"
              variant="primary"
              loading={submitting}
            >
              <Plus size={17} />
              Create Branch
            </Button>
          </div>
        }
      >
        <form
          id="create-branch-form"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {formError && (
            <div
              className="
                flex
                items-start
                gap-3
                rounded-xl
                border
                border-(--danger-border)
                bg-(--danger-soft)
                p-4
                text-sm
                font-medium
                text-(--danger)
              "
            >
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formError}</p>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="branch-name"
                className="mb-2 block text-sm font-semibold text-(--foreground)"
              >
                Branch Name
              </label>

              <Input
                id="branch-name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Faridabad Main Branch"
              />
            </div>

            <div>
              <label
                htmlFor="branch-phone"
                className="mb-2 block text-sm font-semibold text-(--foreground)"
              >
                Phone Number
              </label>

              <Input
                id="branch-phone"
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    phone: event.target.value,
                  }))
                }
                placeholder="e.g. 9876543210"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="branch-address"
              className="mb-2 block text-sm font-semibold text-(--foreground)"
            >
              Complete Address
            </label>

            <textarea
              id="branch-address"
              required
              rows={4}
              value={form.address}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  address: event.target.value,
                }))
              }
              placeholder="Enter complete branch address"
              className="
                block
                w-full
                resize-none
                rounded-xl
                border
                border-(--input-border)
                bg-(--input-bg)
                px-3.5
                py-3
                text-sm
                text-(--foreground)
                outline-none
                transition
                duration-200
                placeholder:text-(--input-placeholder)
                focus:border-(--accent)
                focus:ring-4
                focus:ring-(--accent-ring)
              "
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  return (
    <Card
      padding="md"
      className="
        group
        overflow-hidden
        transition-all
        duration-200
        hover:-translate-y-0.5
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-(--accent-soft)
            text-(--accent)
            transition-transform
            duration-200
            group-hover:scale-105
          "
        >
          <Building2 size={21} />
        </div>

        <Badge variant={branch.isActive ? "success" : "neutral"}>
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              branch.isActive ? "bg-(--green)" : "bg-(--ink-faint)",
            ].join(" ")}
          />
          {branch.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <h3 className="mt-5 truncate text-lg font-extrabold text-(--foreground)">
        {branch.name}
      </h3>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3">
          <MapPin size={17} className="mt-0.5 shrink-0 text-(--ink-faint)" />

          <p className="text-sm leading-6 text-(--ink-muted)">
            {branch.address}
          </p>
        </div>

        {branch.phone && (
          <div className="flex items-center gap-3">
            <Phone size={16} className="shrink-0 text-(--ink-faint)" />

            <p className="text-sm text-(--ink-muted)">{branch.phone}</p>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-(--line) pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--ink-faint)">
              Branch Status
            </p>

            <p className="mt-1 text-sm font-semibold text-(--foreground)">
              {branch.isActive
                ? "Currently operational"
                : "Currently unavailable"}
            </p>
          </div>

          <div
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-(--surface)
              text-(--ink-muted)
            "
          >
            <Check size={16} />
          </div>
        </div>
      </div>
    </Card>
  );
}
