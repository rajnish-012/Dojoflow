"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  createBranch,
  getBranches,
} from "@/lib/api";

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [form, setForm] =
    useState<BranchForm>(initialForm);

  const loadBranches = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await getBranches();

      setBranches(result.branches || []);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to load branches",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const openForm = () => {
    setForm(initialForm);
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;

    setShowForm(false);
    setForm(initialForm);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!form.name.trim() || !form.address.trim()) {
      setError(
        "Please enter the branch name and complete address.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      await createBranch({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
      });

      setForm(initialForm);
      setShowForm(false);

      await loadBranches();
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to create branch",
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
        branch.phone?.toLowerCase().includes(query)
      );
    });
  }, [branches, search]);

  const activeBranches = branches.filter(
    (branch) => branch.isActive,
  ).length;

  const inactiveBranches = branches.filter(
    (branch) => !branch.isActive,
  ).length;

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-4 py-5 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-600">
            <Building2 size={16} />
            Academy Management
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Branch Management
          </h1>

          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Create and manage your academy branches,
            locations, and operational details.
          </p>
        </div>

        <button
          type="button"
          onClick={openForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/10 transition hover:bg-orange-600"
        >
          <Plus size={18} />
          Add Branch
        </button>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          icon={<Building2 size={21} />}
          label="Total Branches"
          value={branches.length}
          description="All academy locations"
        />

        <SummaryCard
          icon={<CheckCircle2 size={20} />}
          label="Active Branches"
          value={activeBranches}
          description="Currently operational"
        />

        <SummaryCard
          icon={<Building2 size={20} />}
          label="Inactive Branches"
          value={inactiveBranches}
          description="Currently unavailable"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="rounded-md p-1 transition hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search and Directory */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-5 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Branch directory
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              View and manage your academy locations.
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search branches..."
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div className="h-12 w-12 rounded-xl bg-slate-200" />
                    <div className="h-6 w-16 rounded-full bg-slate-200" />
                  </div>

                  <div className="mb-3 h-5 w-3/4 rounded bg-slate-200" />
                  <div className="mb-2 h-4 w-full rounded bg-slate-200" />
                  <div className="h-4 w-2/3 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                <Building2 size={28} />
              </div>

              <h2 className="text-lg font-semibold text-slate-800">
                {search
                  ? "No matching branches found"
                  : "No branches created yet"}
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                {search
                  ? "Try searching with another branch name, address, or phone number."
                  : "Create your first branch using the Add Branch button."}
              </p>

              {!search && (
                <button
                  type="button"
                  onClick={openForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  <Plus size={17} />
                  Create First Branch
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredBranches.map((branch) => (
                <div
                  key={branch._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                >
                  {/* Card Top */}
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                      <Building2 size={22} />
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        branch.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          branch.isActive
                            ? "bg-emerald-500"
                            : "bg-slate-400"
                        }`}
                      />

                      {branch.isActive
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  {/* Branch Name */}
                  <h2 className="text-lg font-bold text-slate-950">
                    {branch.name}
                  </h2>

                  {/* Details */}
                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={17}
                        className="mt-0.5 shrink-0 text-slate-400"
                      />

                      <p className="text-sm leading-6 text-slate-600">
                        {branch.address}
                      </p>
                    </div>

                    {branch.phone && (
                      <div className="flex items-center gap-3">
                        <Phone
                          size={16}
                          className="shrink-0 text-slate-400"
                        />

                        <p className="text-sm text-slate-600">
                          {branch.phone}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Branch Status
                        </p>

                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {branch.isActive
                            ? "Currently operational"
                            : "Currently unavailable"}
                        </p>
                      </div>

                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                        <Check size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredBranches.length > 0 && (
          <div className="border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-400">
              Showing {filteredBranches.length} of{" "}
              {branches.length} branches
            </p>
          </div>
        )}
      </div>

      {/* Create Branch Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]"
          onClick={closeForm}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-orange-600">
                  Academy Management
                </p>

                <h2 className="text-xl font-bold text-slate-950">
                  Create New Branch
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add the details of your new academy branch.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={21} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSubmit}
              className="p-6"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Branch Name
                  </label>

                  <input
                    required
                    value={form.name}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Faridabad Main Branch"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Phone Number
                  </label>

                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        phone: event.target.value,
                      })
                    }
                    placeholder="e.g. 9876543210"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Complete Address
                  </label>

                  <textarea
                    required
                    rows={4}
                    value={form.address}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        address: event.target.value,
                      })
                    }
                    placeholder="Enter complete branch address"
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>

              {/* Form Error */}
              {error && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Form Actions */}
              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <RefreshCw
                        size={17}
                        className="animate-spin"
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={17} />
                      Create Branch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          {icon}
        </div>
       

        <span className="text-sm font-medium text-slate-400">
          DojoFlow
        </span>
      </div>

      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}