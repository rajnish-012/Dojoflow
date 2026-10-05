"use client";

import {
  ArrowLeft,
  ArrowRight,
  Home,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useAuth } from "@/hooks/userAuth";
import { getRoleDashboardPath } from "@/lib/current-user";
import { useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "your academy";

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/dashboard");
  };

  const handleDashboard = () => {
    router.push(getRoleDashboardPath(user?.role));
  };

  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <Card className="w-full max-w-xl overflow-hidden">
        <div className="relative px-6 py-10 text-center sm:px-10 sm:py-12">
          {/* Decorative background */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[var(--accent-soft)] opacity-60 blur-3xl" />
            <div className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-[var(--info-soft)] opacity-60 blur-3xl" />
          </div>

          <div className="relative">
            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger-soft)] text-[var(--danger)]">
                <LockKeyhole
                  size={26}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Status */}
            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
              <ShieldAlert
                size={14}
                aria-hidden="true"
              />

              <span>Access Restricted</span>
            </div>

            {/* Heading */}
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              You don&apos;t have access to this page
            </h1>

            {/* Description */}
            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--foreground-soft)] sm:text-base">
              Your account does not have the required permission
              to access this area of {academyName}. If you believe
              this is a mistake, please contact your academy
              administrator.
            </p>

            {/* Actions */}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                onClick={handleGoBack}
              >
                <ArrowLeft
                  size={17}
                  aria-hidden="true"
                />

                <span>Go Back</span>
              </Button>

              <Button
                type="button"
                onClick={handleDashboard}
              >
                <Home
                  size={17}
                  aria-hidden="true"
                />

                <span>Go to Dashboard</span>

                <ArrowRight
                  size={16}
                  aria-hidden="true"
                />
              </Button>
            </div>

            {/* Help text */}
            <div className="mx-auto mt-8 max-w-md border-t border-[var(--line)] pt-5">
              <p className="text-xs leading-5 text-[var(--ink-muted)]">
                Access is controlled by your assigned role and
                permissions. Your administrator can update your
                access if necessary.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
