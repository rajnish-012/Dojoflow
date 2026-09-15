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

const API_URL = "http://localhost:5000/api";

type LoginRole = "admin" | "coach" | "student";

type UserRole =
  | "SUPER_ADMIN"
  | "BRANCH_ADMIN"
  | "COACH"
  | "STUDENT";

const roleDetails = {
  admin: {
    title: "Admin Login",
    description: "Manage your academy, staff, students and operations.",
    icon: ShieldCheck,
    allowedRoles: ["SUPER_ADMIN", "BRANCH_ADMIN"] as UserRole[],
  },
  coach: {
    title: "Coach / Instructor Login",
    description: "Manage training, attendance and student performance.",
    icon: UserRound,
    allowedRoles: ["COACH"] as UserRole[],
  },
  student: {
    title: "Student / Parent Login",
    description: "View training progress, attendance and academy details.",
    icon: GraduationCap,
    allowedRoles: ["STUDENT"] as UserRole[],
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

  // Read selected login type from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");

    if (
      role === "admin" ||
      role === "coach" ||
      role === "student"
    ) {
      setSelectedRole(role);
    }
  }, []);

  // Redirect already logged-in users to the correct portal
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      return;
    }

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
    setError("");

    router.push(`/login?role=${role}`);
  }

  function handleBackToRoleSelection() {
    setSelectedRole(null);
    setEmail("");
    setPassword("");
    setError("");

    router.push("/login");
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

      if (!token) {
        throw new Error(
          "Login successful, but no authentication token was received.",
        );
      }

      const user = data.user || data.data?.user || null;

      if (!user || !user.role) {
        throw new Error(
          "Login successful, but user information was not received.",
        );
      }

      const selectedRoleDetails = roleDetails[selectedRole];

      // Verify that the selected login type matches the actual account role
      if (!selectedRoleDetails.allowedRoles.includes(user.role)) {
        throw new Error(
          `This account cannot log in as ${selectedRoleDetails.title}. Please select the correct login type.`,
        );
      }

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // Redirect based on actual backend role
      if (user.role === "STUDENT") {
        router.replace("/student-dashboard");
      } else {
        router.replace("/dashboard");
      }
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to login. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectedRoleDetails = selectedRole
    ? roleDetails[selectedRole]
    : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* Left Side */}
        <div className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-slate-900">
                D
              </div>

              <div>
                <p className="text-lg font-bold">DojoFlow</p>

                <p className="text-xs text-slate-400">
                  Karate Academy Management
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck className="h-7 w-7 text-white" />
            </div>

            <h1 className="text-4xl font-bold leading-tight">
              Manage your dojo.
              <br />
              Track every student.
            </h1>

            <p className="mt-5 text-base leading-7 text-slate-400">
              Manage students, training plans, attendance, performance
              evaluations and belt progression from one place.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            DojoFlow · Karate Academy Management System
          </p>
        </div>

        {/* Right Side */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
                D
              </div>

              <div>
                <p className="text-lg font-bold text-slate-900">
                  DojoFlow
                </p>

                <p className="text-xs text-slate-500">
                  Karate Academy Management
                </p>
              </div>
            </div>

            {!selectedRole ? (
              /* Role Selection */
              <div>
                <div className="mb-8">
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                    Welcome to DojoFlow
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    Choose how you want to access the academy.
                  </p>
                </div>

                <div className="space-y-4">
                  {(Object.keys(roleDetails) as LoginRole[]).map(
                    (role) => {
                      const details = roleDetails[role];
                      const Icon = details.icon;

                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleRoleSelection(role)}
                          className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-md"
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                            <Icon className="h-6 w-6" />
                          </div>

                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900">
                              {details.title}
                            </h3>

                            <p className="mt-1 text-sm leading-5 text-slate-500">
                              {details.description}
                            </p>
                          </div>

                          <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                        </button>
                      );
                    },
                  )}
                </div>

                <p className="mt-8 text-center text-xs text-slate-400">
                  Select your account type to continue.
                </p>
              </div>
            ) : (
              /* Login Form */
              <div>
                <button
                  type="button"
                  onClick={handleBackToRoleSelection}
                  className="mb-7 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change login type
                </button>

                <div className="mb-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
                    {selectedRoleDetails && (
                      <selectedRoleDetails.icon className="h-6 w-6" />
                    )}
                  </div>

                  <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                    {selectedRoleDetails?.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    {selectedRoleDetails?.description}
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm leading-5 text-red-700">
                      {error}
                    </p>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>

                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) =>
                          setEmail(event.target.value)
                        }
                        placeholder="Enter your email"
                        className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>

                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        placeholder="Enter your password"
                        className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((current) => !current)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                        aria-label={
                          showPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                

                <p className="mt-8 text-center text-xs text-slate-400">
                  Secure access for DojoFlow users
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}