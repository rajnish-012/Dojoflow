"use client";

import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Award,
  BookOpen,
  LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:5000/api";

type Student = {
  _id: string;
  name: string;
  age: number;
  phone: string;
  email?: string;
  currentBelt: string;
  status: string;
  joinDate: string;
  branch?: {
    _id: string;
    name: string;
    address?: string;
  };
  plan?: {
    _id: string;
    name: string;
    price: number;
    duration: number;
    startingBelt: string;
  };
};

export default function StudentDashboard() {
  const router = useRouter();

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadStudent = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          router.replace("/login");
          return;
        }

        const response = await fetch(
          `${API_URL}/students/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load student profile"
          );
        }

        setStudent(data.student);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load student profile"
        );
      } finally {
        setLoading(false);
      }
    };

    loadStudent();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          <p className="text-sm text-slate-500">
            Loading your profile...
          </p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm border border-slate-200">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <User className="h-6 w-6 text-red-500" />
          </div>

          <h2 className="text-xl font-semibold text-slate-900">
            Profile not found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {error ||
              "Your student profile is not linked to your account yet."}
          </p>

          <button
            onClick={handleLogout}
            className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              DojoFlow
            </h1>
            <p className="text-xs text-slate-500">
              Karate Academy
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {student.name}
              </p>
              <p className="text-xs text-slate-500">
                Student
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
              {student.name
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500">
            Student Portal
          </p>

          <h2 className="mt-1 text-3xl font-bold text-slate-900">
            Welcome, {student.name.split(" ")[0]}
          </h2>

          <p className="mt-2 text-slate-500">
            Here you can view your karate training details,
            plan and profile.
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-5 md:grid-cols-3">
          {/* Belt */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Current Belt
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {student.currentBelt}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
                <Award className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Plan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Training Plan
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {student.plan?.name || "Not assigned"}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Status
                </p>

                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {student.status}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                <User className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Profile + Plan */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Personal Information */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <User className="h-5 w-5 text-slate-700" />
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  My Profile
                </h3>

                <p className="text-sm text-slate-500">
                  Your personal information
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <User className="h-5 w-5 text-slate-400" />

                <div>
                  <p className="text-xs text-slate-500">
                    Full Name
                  </p>

                  <p className="font-medium text-slate-900">
                    {student.name}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <CalendarDays className="h-5 w-5 text-slate-400" />

                <div>
                  <p className="text-xs text-slate-500">
                    Age
                  </p>

                  <p className="font-medium text-slate-900">
                    {student.age} years
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Phone className="h-5 w-5 text-slate-400" />

                <div>
                  <p className="text-xs text-slate-500">
                    Phone
                  </p>

                  <p className="font-medium text-slate-900">
                    {student.phone}
                  </p>
                </div>
              </div>

              {student.email && (
                <div className="flex items-center gap-4">
                  <Mail className="h-5 w-5 text-slate-400" />

                  <div>
                    <p className="text-xs text-slate-500">
                      Contact Email
                    </p>

                    <p className="font-medium text-slate-900">
                      {student.email}
                    </p>
                  </div>
                </div>
              )}

              {student.branch && (
                <div className="flex items-center gap-4">
                  <MapPin className="h-5 w-5 text-slate-400" />

                  <div>
                    <p className="text-xs text-slate-500">
                      Branch
                    </p>

                    <p className="font-medium text-slate-900">
                      {student.branch.name}
                    </p>

                    {student.branch.address && (
                      <p className="text-sm text-slate-500">
                        {student.branch.address}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <CalendarDays className="h-5 w-5 text-slate-400" />

                <div>
                  <p className="text-xs text-slate-500">
                    Joined
                  </p>

                  <p className="font-medium text-slate-900">
                    {new Date(
                      student.joinDate
                    ).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Training Plan */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>

              <div>
                <h3 className="font-semibold text-slate-900">
                  My Training Plan
                </h3>

                <p className="text-sm text-slate-500">
                  Your current karate program
                </p>
              </div>
            </div>

            {student.plan ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-slate-500">
                    Plan
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {student.plan.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      Duration
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {student.plan.duration} days
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">
                      Starting Belt
                    </p>

                    <p className="mt-1 font-semibold text-slate-900">
                      {student.plan.startingBelt}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">
                    Plan Price
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    ₹{student.plan.price}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                No training plan assigned.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}