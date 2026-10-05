"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AcademyLogo, useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000/api" : "");

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "Your Academy";
  const academyTagline = settings.tagline.trim() || "Academy management";
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Password recovery is temporarily unavailable. Please try again later.");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit your request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-5 py-10 text-[#172033]">
      <section className="w-full max-w-md rounded-2xl border border-[#e3e8ef] bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-7 flex min-w-0 items-center gap-3">
          <AcademyLogo className="h-11 w-11 shrink-0 rounded-xl border border-[#e3e8ef] bg-white p-1 object-contain text-[#172033]" />
          <div className="min-w-0">
            <p className="truncate font-bold">{academyName}</p>
            <p className="truncate text-xs text-[#697386]">{academyTagline}</p>
          </div>
        </div>
        <h1 className="text-2xl font-black">Reset your password</h1>
        <p className="mt-2 text-sm leading-6 text-[#697386]">Enter the email address associated with your academy account. If it matches an active account, we’ll send reset instructions.</p>
        {submitted ? (
          <div role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">If an active account matches that email, password reset instructions will be sent.</div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-semibold" htmlFor="recovery-email">Email address</label>
            <input id="recovery-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-[#dfe5ed] px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-[#101a33] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Sending…" : "Send reset instructions"}</button>
          </form>
        )}
        <button type="button" onClick={() => router.push("/login")} className="mt-6 text-sm font-semibold text-blue-700">Back to sign in</button>
      </section>
    </main>
  );
}
