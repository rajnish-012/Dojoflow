"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AcademyLogo, useAcademyBrand } from "@/components/settings/AcademyBrandProvider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://localhost:5000/api" : "");

export default function ResetPasswordPage() {
  const router = useRouter();
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "Your Academy";
  const academyTagline = settings.tagline.trim() || "Academy management";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmation) return setError("Passwords do not match.");
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    if (!token) return setError("Reset link is invalid or expired.");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Reset link is invalid or expired.");
      window.history.replaceState(null, "", window.location.pathname);
      setMessage("Your password has been reset. Sign in with your new password.");
      setPassword("");
      setConfirmation("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password.");
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
        <h1 className="text-2xl font-black">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-[#697386]">Use at least 12 characters. Passwords can be a phrase; no special character rules are required.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold" htmlFor="new-password">New password</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-[#dfe5ed] px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          <label className="block text-sm font-semibold" htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-xl border border-[#dfe5ed] px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {message && <p role="status" className="text-sm text-emerald-800">{message}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-[#101a33] px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{loading ? "Saving…" : "Reset password"}</button>
        </form>
        <button type="button" onClick={() => router.push("/login")} className="mt-6 text-sm font-semibold text-blue-700">Back to sign in</button>
      </section>
    </main>
  );
}
