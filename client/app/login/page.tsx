"use client";


import { fetchWithSession } from "@/lib/sessionFetch";
import { FormEvent, useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  Globe,
  LockKeyhole,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/hooks/userAuth";
import { AcademyLogo, useAcademyBrand } from "@/components/settings/AcademyBrandProvider";
import {
  AUTH_CHANGED_EVENT,
  getRoleDashboardPath,
  setCurrentUser,
} from "@/lib/current-user";
import { getCurrentUser } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type LoginRole = "admin" | "coach" | "student";

type RoleDetail = {
  title: string;
  description: string;
  icon: LucideIcon;
  isAllowed: (role: string) => boolean;
};

const ADMIN_ROLES = ["SUPER_ADMIN", "BRANCH_ADMIN"];

const roleDetails: Record<LoginRole, RoleDetail> = {
  admin: {
    title: "Admin Login (Super / Branch Admin)",
    description:
      "Manage your academy, staff, students and operations.",
    icon: ShieldCheck,
    isAllowed: (role) => ADMIN_ROLES.includes(role),
  },

  coach: {
    title: "Coach / Staff Login",
    description:
      "Manage training, attendance and student performance.",
    icon: UserRound,

    // Coaches and every custom role created in the Roles page.
    isAllowed: (role) =>
      role !== "STUDENT" && !ADMIN_ROLES.includes(role),
  },

  student: {
    title: "Student / Parent Login",
    description:
      "View training progress, attendance and academy details.",
    icon: GraduationCap,
    isAllowed: (role) => role === "STUDENT",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "Your Academy";
  const academyTagline = settings.tagline.trim() || "Academy management";

  const [selectedRole, setSelectedRole] =
    useState<LoginRole | null>(null);

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * Read the selected login type from the URL.
   *
   * Example:
   * /login?role=admin
   * /login?role=coach
   * /login?role=student
   */
  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const role = params.get("role");

    if (
      role === "admin" ||
      role === "coach" ||
      role === "student"
    ) {
      setSelectedRole(role);
    }
  }, []);

  /*
   * Authentication state.
   *
   * This replaces the old approach of trusting only
   * localStorage inside the login page.
   *
   * useAuth() verifies the authenticated user through
   * /auth/me.
   */
  const {
    isLoading: authLoading,
    isAuthenticated,
    user: authenticatedUser,
  } = useAuth();

  /*
   * If an already authenticated user opens /login,
   * send them to the appropriate dashboard.
   *
   * We wait until useAuth() has finished checking
   * the current authentication state.
   */
  useEffect(() => {
    if (
      authLoading ||
      !isAuthenticated
    ) {
      return;
    }

    router.replace(
      getRoleDashboardPath(authenticatedUser?.role),
    );
  }, [
    authLoading,
    isAuthenticated,
    authenticatedUser?.role,
    router,
  ]);

  /*
   * Select login type.
   */
  function handleRoleSelection(
    role: LoginRole,
  ) {
    setSelectedRole(role);

    setEmail("");

    setPassword("");

    setError("");

    setShowPassword(false);

    router.push(
      `/login?role=${role}`,
    );
  }

  /*
   * Return to role selection.
   */
  function handleBackToRoleSelection() {
    setSelectedRole(null);

    setEmail("");

    setPassword("");

    setError("");

    setShowPassword(false);

    router.push("/login");
  }

  /*
   * Return to public landing page.
   */
  function handleBackToLandingPage() {
    router.push("/");
  }

  /*
   * Login submit.
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    /*
     * Validate login type.
     */
    if (!selectedRole) {
      setError(
        "Please select a login type.",
      );

      return;
    }

    /*
     * Validate email.
     */
    if (!email.trim()) {
      setError(
        "Please enter your email.",
      );

      return;
    }

    /*
     * Validate password.
     */
    if (!password) {
      setError(
        "Please enter your password.",
      );

      return;
    }

    try {
      setLoading(true);

      /*
       * Do not silently fall back to localhost.
       *
       * The application should always use the
       * configured NEXT_PUBLIC_API_URL.
       */
      if (!API_URL) {
        throw new Error(
          "API URL is not configured. Please set NEXT_PUBLIC_API_URL.",
        );
      }

      /*
       * Authenticate against the backend.
       */
      const response =
        await fetchWithSession(
          `${API_URL}/auth/login`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },
            credentials: "include",

            body: JSON.stringify({
              email: email.trim(),
              password,
            }),
          },
        );

      const data =
        await response.json();

      /*
       * Backend rejected login.
       */
      if (!response.ok) {
        throw new Error(
          data.message ||
            "Invalid email or password.",
        );
      }

      /*
       * Support the response formats currently
       * used by the backend.
       */
      const user =
        data.user ||
        data.data?.user;

      /*
       * Make sure authentication response
       * contains the required information.
       */
      if (
        !user?.role
      ) {
        throw new Error(
          "Invalid login response from server.",
        );
      }

      /*
       * Verify that the selected login portal
       * matches the actual backend role.
       */
      const selectedRoleDetails =
        roleDetails[
          selectedRole
        ];

      if (
        !selectedRoleDetails.isAllowed(
          user.role,
        )
      ) {
        await fetchWithSession(`${API_URL}/auth/logout`, { method: "POST" });
        throw new Error(
          `This account cannot log in as ${selectedRoleDetails.title}.`,
        );
      }

      /*
       * Save authentication state.
       */
      const authenticatedUser = await getCurrentUser();
      setCurrentUser(authenticatedUser);

      /*
       * Notify the shared auth state to refresh /auth/me
       * after the server has set the HttpOnly session cookie.
       */
      window.dispatchEvent(
        new Event(
          AUTH_CHANGED_EVENT,
        ),
      );

      /*
       * Send the user to the appropriate dashboard.
       *
       * The UI profile comes from the server session.
       */
      router.replace(
        getRoleDashboardPath(authenticatedUser.role),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to login. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedRoleDetails =
    selectedRole
      ? roleDetails[selectedRole]
      : null;

  const SelectedRoleIcon =
    selectedRoleDetails?.icon;

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left Panel */}

        <section className="relative hidden overflow-hidden bg-[#101a33] px-10 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(215,168,75,0.2),transparent_30%),radial-gradient(circle_at_0%_100%,rgba(54,98,160,0.25),transparent_38%)]" />

          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px]" />

          {/* Logo */}

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-(--accent-soft) p-1">
              <AcademyLogo className="h-full w-full rounded-xl object-contain text-(--accent)" />
            </div>

            <div>
              <p className="text-xl font-black">
                {academyName}
              </p>

              <p className="text-xs text-white/45">
                {academyTagline}
              </p>
            </div>
          </div>

          {/* Main Content */}

          <div className="relative max-w-lg">
            <div className="mb-6 inline-flex rounded-full border border-(--accent)/25 bg-(--accent-soft) px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
              {academyTagline}
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-[-0.04em] xl:text-6xl">
              Train with purpose.

              <span className="mt-2 block text-(--accent)">
                Manage with clarity.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-8 text-white/55">
              Manage students, coaches,
              attendance, training plans,
              performance, and academy growth
              from one platform.
            </p>

            <div className="mt-9 max-w-md space-y-3 border-t border-white/10 pt-6 text-sm text-white/60">
              {settings.contactPhone && <p className="flex items-center gap-2"><Phone size={15} />{settings.contactPhone}</p>}
              {settings.contactEmail && <p className="flex items-center gap-2"><Mail size={15} />{settings.contactEmail}</p>}
              {settings.address && <p className="flex items-center gap-2"><MapPin size={15} />{settings.address}</p>}
              {settings.website && <a className="flex items-center gap-2 hover:text-white" href={settings.website} target="_blank" rel="noreferrer"><Globe size={15} />{settings.website}</a>}
              {!settings.contactPhone && !settings.contactEmail && !settings.address && !settings.website && (
                <p>Sign in to access your academy workspace.</p>
              )}
            </div>
          </div>

          <p className="relative text-xs text-white/30">
            © {new Date().getFullYear()} {academyName}
          </p>
        </section>

        {/* Right Panel */}

        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            {/* Mobile Logo */}

            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-(--accent-soft) p-1">
                <AcademyLogo className="h-full w-full rounded-lg object-contain text-(--accent)" />
              </div>

              <div>
                <p className="text-lg font-black text-[#101a33]">
                  {academyName}
                </p>

                <p className="text-xs text-[#697386]">
                  {academyTagline}
                </p>
              </div>
            </div>

            {!selectedRole ? (
              /* Role Selection Page */

              <div className="mx-auto max-w-lg">
                {/* Back Button Only Here */}

                <div className="mb-7">
                  <button
                    type="button"
                    onClick={
                      handleBackToLandingPage
                    }
                    className="group mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#697386] transition hover:text-[#101a33]"
                  >
                    <ArrowLeft
                      size={16}
                      className="transition group-hover:-translate-x-1"
                    />

                    Back to website
                  </button>
                </div>

                {/* Heading */}

                <div className="mb-7">
                  <div className="mb-4 inline-flex rounded-full bg-(--accent-soft) px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-(--accent)">
                    Secure portal access
                  </div>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-[#101a33] sm:text-4xl">
                    Welcome to

                    <span className="block text-(--accent)">
                      {academyName}.
                    </span>
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#697386]">
                    Choose your account type
                    to continue.
                  </p>
                </div>

                {/* Three Login Options */}

                <div className="space-y-3">
                  {(
                    Object.keys(
                      roleDetails,
                    ) as LoginRole[]
                  ).map((role) => {
                    const details =
                      roleDetails[role];

                    const Icon =
                      details.icon;

                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() =>
                          handleRoleSelection(
                            role,
                          )
                        }
                        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-[#e1e6ee] bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-(--accent) hover:shadow-lg sm:p-5"
                      >
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-(--accent) opacity-0 transition group-hover:opacity-100" />

                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--surface-muted) text-[#34445d] transition group-hover:bg-[#101a33] group-hover:text-(--accent)">
                          <Icon size={27} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-extrabold text-[#101a33] sm:text-lg">
                            {details.title}
                          </h3>

                          <p className="mt-1 text-sm leading-5 text-[#697386]">
                            {details.description}
                          </p>
                        </div>

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--surface-muted) transition group-hover:bg-(--accent-soft)">
                          <ArrowRight
                            size={18}
                            className="text-[#9aabc2] transition group-hover:translate-x-1 group-hover:text-(--accent)"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-6 text-center text-xs text-[#9aa5b5]">
                  Secure access for authorized
                  {academyName} users
                </p>
              </div>
            ) : (
              /* Login Form Page */

              <div className="mx-auto max-w-md">
                <button
                  type="button"
                  onClick={
                    handleBackToRoleSelection
                  }
                  className="group mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#697386] transition hover:text-[#101a33]"
                >
                  <ArrowLeft
                    size={16}
                    className="transition group-hover:-translate-x-1"
                  />

                  Change login type
                </button>

                <div className="mb-7">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#101a33] text-(--accent)">
                    {SelectedRoleIcon && (
                      <SelectedRoleIcon
                        size={28}
                      />
                    )}
                  </div>

                  <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-(--accent)">
                    {selectedRole ===
                    "student"
                      ? "Student portal"
                      : selectedRole ===
                          "coach"
                        ? "Instructor portal"
                        : "Administration portal"}
                  </p>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-[#101a33]">
                    {selectedRoleDetails?.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#697386]">
                    {
                      selectedRoleDetails?.description
                    }
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">
                      {error}
                    </p>
                  </div>
                )}

                <form
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  {/* Email */}

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-bold text-[#34445d]"
                    >
                      Email Address
                    </label>

                    <div className="relative">
                      <Mail
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9aabc2]"
                      />

                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Enter your email"
                        className="w-full rounded-xl border border-[#dfe5ed] bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#a5afbd] focus:border-(--accent) focus:ring-4 focus:ring-(--accent-soft)"
                      />
                    </div>
                  </div>

                  {/* Password */}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="text-sm font-bold text-[#34445d]"
                      >
                        Password
                      </label>

                      <button
                        type="button"
                        onClick={() => router.push("/forgot-password")}
                        className="text-xs font-semibold text-(--accent)"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <div className="relative">
                      <LockKeyhole
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9aabc2]"
                      />

                      <input
                        id="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) =>
                          setPassword(
                            event.target
                              .value,
                          )
                        }
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-[#dfe5ed] bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition placeholder:text-[#a5afbd] focus:border-(--accent) focus:ring-4 focus:ring-(--accent-soft)"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (current) =>
                              !current,
                          )
                        }
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aabc2] hover:text-[#34445d]"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff
                            size={18}
                          />
                        ) : (
                          <Eye
                            size={18}
                          />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#101a33] px-4 py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#1c2d52] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In

                        <ArrowRight
                          size={17}
                        />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e4e8ef]" />

                  <span className="text-xs text-[#9aa5b5]">
                    Secure access
                  </span>

                  <div className="h-px flex-1 bg-[#e4e8ef]" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
