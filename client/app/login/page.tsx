"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
    title: "Admin Login",
    description: "Manage your academy, staff, students and operations.",
    icon: ShieldCheck,
    isAllowed: (role) => ADMIN_ROLES.includes(role),
  },
  coach: {
    title: "Coach / Staff Login",
    description: "Manage training, attendance and student performance.",
    icon: UserRound,
    // Coaches and every custom role created in the Roles page.
    isAllowed: (role) => role !== "STUDENT" && !ADMIN_ROLES.includes(role),
  },
  student: {
    title: "Student / Parent Login",
    description: "View training progress, attendance and academy details.",
    icon: GraduationCap,
    isAllowed: (role) => role === "STUDENT",
  },
};

export default function LoginPage() {
  const router = useRouter();

  const [selectedRole, setSelectedRole] = useState<LoginRole | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");

    if (role === "admin" || role === "coach" || role === "student") {
      setSelectedRole(role);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) return;

    try {
      const user = JSON.parse(storedUser);

      if (user.role === "STUDENT") {
        router.replace("/student-dashboard");
      } else {
        router.replace("/dashboard");
      }
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [router]);

  function handleRoleSelection(role: LoginRole) {
    setSelectedRole(role);
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);

    router.push(`/login?role=${role}`);
  }

  function handleBackToRoleSelection() {
    setSelectedRole(null);
    setEmail("");
    setPassword("");
    setError("");
    setShowPassword(false);

    router.push("/login");
  }

  function handleBackToLandingPage() {
    router.push("/");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedRole) {
      setError("Please select a login type.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid email or password.");
      }

      const token =
        data.token ||
        data.data?.token ||
        data.accessToken ||
        data.data?.accessToken;

      const user = data.user || data.data?.user;

      if (!token || !user?.role) {
        throw new Error("Invalid login response from server.");
      }

      const selectedRoleDetails = roleDetails[selectedRole];

      if (!selectedRoleDetails.isAllowed(user.role)) {
        throw new Error(
          `This account cannot log in as ${selectedRoleDetails.title}.`,
        );
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      if (user.role === "STUDENT") {
        router.replace("/student-dashboard");
      } else {
        router.replace("/dashboard");
      }
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

  const selectedRoleDetails = selectedRole ? roleDetails[selectedRole] : null;

  const SelectedRoleIcon = selectedRoleDetails?.icon;

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        {/* Left Panel */}
        <section className="relative hidden overflow-hidden bg-[#101a33] px-10 py-8 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(215,168,75,0.2),transparent_30%),radial-gradient(circle_at_0%_100%,rgba(54,98,160,0.25),transparent_38%)]" />

          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px]" />

          {/* Logo */}
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d7a84b] text-xl font-black text-[#101a33]">
              D
            </div>

            <div>
              <p className="text-xl font-black">DojoFlow</p>
              <p className="text-xs text-white/45">Karate Academy Management</p>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative max-w-lg">
            <div className="mb-6 inline-flex rounded-full border border-[#d7a84b]/25 bg-[#d7a84b]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e5c477]">
              Your academy, connected
            </div>

            <h1 className="text-5xl font-black leading-[1.08] tracking-[-0.04em] xl:text-6xl">
              Train with purpose.
              <span className="mt-2 block text-[#d7a84b]">
                Manage with clarity.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-8 text-white/55">
              Manage students, coaches, attendance, training plans, performance,
              and academy growth from one platform.
            </p>

            <div className="mt-9 grid max-w-md grid-cols-3 gap-5 border-t border-white/10 pt-6">
              <div>
                <p className="text-2xl font-black">500+</p>
                <p className="mt-1 text-xs text-white/40">Students managed</p>
              </div>

              <div>
                <p className="text-2xl font-black">15+</p>
                <p className="mt-1 text-xs text-white/40">Years of expertise</p>
              </div>

              <div>
                <p className="text-2xl font-black">24/7</p>
                <p className="mt-1 text-xs text-white/40">Platform access</p>
              </div>
            </div>
          </div>

          <p className="relative text-xs text-white/30">
            © {new Date().getFullYear()} DojoFlow
          </p>
        </section>

        {/* Right Panel */}
        <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-xl">
            {/* Mobile Logo */}
            <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#101a33] text-lg font-black text-white">
                D
              </div>

              <div>
                <p className="text-lg font-black text-[#101a33]">DojoFlow</p>
                <p className="text-xs text-[#697386]">
                  Karate Academy Management
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
                    onClick={handleBackToLandingPage}
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
                  <div className="mb-4 inline-flex rounded-full bg-[#f8efde] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#a87418]">
                    Secure portal access
                  </div>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-[#101a33] sm:text-4xl">
                    Welcome to
                    <span className="block text-[#a87418]">DojoFlow.</span>
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#697386]">
                    Choose your account type to continue.
                  </p>
                </div>

                {/* Three Login Options */}
                <div className="space-y-3">
                  {(Object.keys(roleDetails) as LoginRole[]).map((role) => {
                    const details = roleDetails[role];
                    const Icon = details.icon;

                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleSelection(role)}
                        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-[#e1e6ee] bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#d7a84b] hover:shadow-lg sm:p-5"
                      >
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-[#d7a84b] opacity-0 transition group-hover:opacity-100" />

                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f1f4f8] text-[#34445d] transition group-hover:bg-[#101a33] group-hover:text-[#d7a84b]">
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

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f7fb] transition group-hover:bg-[#f8efde]">
                          <ArrowRight
                            size={18}
                            className="text-[#9aabc2] transition group-hover:translate-x-1 group-hover:text-[#a87418]"
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-6 text-center text-xs text-[#9aa5b5]">
                  Secure access for authorized DojoFlow users
                </p>
              </div>
            ) : (
              /* Login Form Page */
              <div className="mx-auto max-w-md">
                <button
                  type="button"
                  onClick={handleBackToRoleSelection}
                  className="group mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#697386] transition hover:text-[#101a33]"
                >
                  <ArrowLeft
                    size={16}
                    className="transition group-hover:-translate-x-1"
                  />
                  Change login type
                </button>

                <div className="mb-7">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#101a33] text-[#d7a84b]">
                    {SelectedRoleIcon && <SelectedRoleIcon size={28} />}
                  </div>

                  <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#a87418]">
                    {selectedRole === "student"
                      ? "Student portal"
                      : selectedRole === "coach"
                        ? "Instructor portal"
                        : "Administration portal"}
                  </p>

                  <h2 className="text-3xl font-black tracking-[-0.04em] text-[#101a33]">
                    {selectedRoleDetails?.title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#697386]">
                    {selectedRoleDetails?.description}
                  </p>
                </div>

                {error && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
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
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        className="w-full rounded-xl border border-[#dfe5ed] bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition placeholder:text-[#a5afbd] focus:border-[#a87418] focus:ring-4 focus:ring-[#d7a84b]/10"
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
                        onClick={() =>
                          setError(
                            "Please contact your academy administrator to reset your password.",
                          )
                        }
                        className="text-xs font-semibold text-[#a87418]"
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
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-xl border border-[#dfe5ed] bg-white py-3.5 pl-11 pr-12 text-sm outline-none transition placeholder:text-[#a5afbd] focus:border-[#a87418] focus:ring-4 focus:ring-[#d7a84b]/10"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9aabc2] hover:text-[#34445d]"
                      >
                        {showPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
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
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-7 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#e4e8ef]" />
                  <span className="text-xs text-[#9aa5b5]">Secure access</span>
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
