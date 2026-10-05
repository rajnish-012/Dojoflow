"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { ArrowLeft, ArrowRight, CheckCircle2, Dumbbell, Loader2, Sparkles } from "lucide-react";
import PublicPlanWeeklySchedule, { type WeeklySessionChoice } from "@/components/public/PublicPlanWeeklySchedule";
import InternationalPhoneInput from "@/components/ui/InternationalPhoneInput";
import { Button, Card } from "@/components/ui";
import { AcademyLogo, useAcademyBrand } from "@/components/settings/AcademyBrandProvider";
import { getPublicTrainingSessionTypes, type TrainingSessionTypeRecord } from "@/lib/trainingSessionTypeApi";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
type PlanProgram = { program: string | { _id: string; name: string; isActive?: boolean }; weeklyLimit?: number | null };
type Plan = { _id: string; name: string; price: number; duration: number; durationUnit: "MONTHS" | "DAYS"; classesPerWeek: number; startingBelt: string; isActive: boolean; programs: PlanProgram[] };
type BranchPreference = { id: string; name: string } | null;

function getProgramId(item: PlanProgram) {
  return typeof item.program === "string" ? item.program : item.program?._id;
}
function getProgramName(item: PlanProgram) {
  return typeof item.program === "string" ? "Program" : item.program?.name || "Program";
}

function SelectionSummary({
  programs,
  plan,
  branchName,
  sessions,
  currency,
}: {
  programs: string[];
  plan: Plan;
  branchName: string;
  sessions: WeeklySessionChoice[];
  currency: string;
}) {
  const durationLabel = `${plan.duration} ${plan.durationUnit === "DAYS" ? "days" : plan.duration === 1 ? "month" : "months"}`;
  return <div className="mt-5 rounded-2xl border border-(--line) bg-(--surface) p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--line) pb-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-(--ink-faint)">Your selection</p><h3 className="mt-1 text-lg font-bold">{plan.name}</h3><p className="text-sm font-semibold text-(--accent)">{new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(Number(plan.price || 0))} / {durationLabel}</p></div>
      <div className="text-right text-xs text-(--ink-muted)"><p>{plan.classesPerWeek} classes per week</p><p className="mt-1">Starting belt: {plan.startingBelt || "Beginner"}</p></div>
    </div>
    <dl className="grid gap-3 border-b border-(--line) py-4 sm:grid-cols-2"><div><dt className="text-[10px] font-bold uppercase tracking-widest text-(--ink-faint)">Program{programs.length === 1 ? "" : "s"}</dt><dd className="mt-1 text-sm font-semibold">{programs.join(", ")}</dd></div><div><dt className="text-[10px] font-bold uppercase tracking-widest text-(--ink-faint)">Branch</dt><dd className="mt-1 text-sm font-semibold">{branchName}</dd></div></dl>
    <div className="pt-4"><p className="text-[10px] font-bold uppercase tracking-widest text-(--ink-faint)">Selected weekly training schedule</p><ul className="mt-3 space-y-2">{sessions.map((session) => <li key={`${session.dayOfWeek}-${session.startTime}-${session.sessionTypeId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--line) bg-(--card) px-3 py-3 text-sm"><span className="min-w-20 rounded-lg bg-(--accent-soft) px-3 py-2 text-center font-bold text-(--accent)">{session.dayName.slice(0, 3)}</span><span className="min-w-0 flex-1"><strong className="block truncate">{session.startTime}–{session.endTime}</strong><span className="text-xs text-(--ink-muted)">{session.sessionTypeName} · {session.sessionName}</span></span></li>)}</ul></div>
  </div>;
}

export default function InquiryPage() {
  const router = useRouter();
  const { settings } = useAcademyBrand();
  const academyName = settings.academyName.trim() || "Your Academy";
  const academyTagline = settings.tagline.trim() || "Train with discipline. Grow with confidence.";
  const [programs, setPrograms] = useState<TrainingSessionTypeRecord[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [branch, setBranch] = useState<BranchPreference>(null);
  const [weeklySessions, setWeeklySessions] = useState<WeeklySessionChoice[]>([]);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_URL}/plans/public`, { cache: "no-store" }).then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Unable to load plans.");
        return (Array.isArray(data.plans) ? data.plans : []) as Plan[];
      }),
      getPublicTrainingSessionTypes(),
    ]).then(([loadedPlans, loadedPrograms]) => {
      if (!cancelled) {
        setPlans(loadedPlans);
        setPrograms(loadedPrograms.filter((program) => program.isActive));
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Unable to load available programs and plans.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categoryPlans = useMemo(() => plans.filter((plan) =>
    categoryIds.every((categoryId) => plan.programs?.some((item) => getProgramId(item) === categoryId && (typeof item.program === "string" || item.program?.isActive !== false))),
  ), [plans, categoryIds]);
  const selectedPrograms = programs.filter((program) => categoryIds.includes(program._id));
  const selectedProgramIds = selectedPlan?.programs?.map(getProgramId).filter((id): id is string => Boolean(id)) || [];
  const programWeeklyLimits = Object.fromEntries((selectedPlan?.programs || []).map((item) => [String(getProgramId(item)), item.weeklyLimit ?? null]));
  const pageHeading = step === 1 ? "What do you want to train?" : step === 2 ? `${selectedPrograms.map((item) => item.name).join(", ")} Plans` : step === 3 ? "Choose training days & slots" : step === 4 ? "Confirm your selection" : step === 5 ? "Send your inquiry" : "Thank you!";

  function chooseCategory(id: string) {
    setCategoryIds([id]);
    setStep(2);
    setSelectedPlan(null);
    setBranch(null);
    setWeeklySessions([]);
  }
  function choosePlan(plan: Plan) {
    setSelectedPlan(plan);
    setBranch(null);
    setWeeklySessions([]);
    setStep(3);
  }
  function goBackToPrograms() {
    setStep(1); setSelectedPlan(null); setBranch(null); setWeeklySessions([]);
  }
  function goBackToPlans() {
    setStep(2); setBranch(null); setWeeklySessions([]);
  }
  function continueToForm() {
    if (!selectedPlan || weeklySessions.length !== selectedPlan.classesPerWeek || !branch) return;
    setStep(4);
  }
  function continueToInquiryForm() {
    setStep(5);
    window.setTimeout(() => document.getElementById("inquiry-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();
    if (fullName.length < 2) return setError("Enter your name (at least 2 characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    if (!isValidPhoneNumber(phone)) return setError("Enter a valid phone number with its country code.");
    if (!selectedPlan || !selectedPrograms.length) return setError("Choose a program and plan before sending your inquiry.");
    if (!branch || weeklySessions.length !== selectedPlan.classesPerWeek) return setError(`Choose a branch and exactly ${selectedPlan.classesPerWeek} weekly sessions.`);
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/inquiries`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName, email, phone, message: form.message.trim(),
          branch: branch.id, preferredBranch: branch.name,
          programs: categoryIds, plan: selectedPlan._id,
          preferredWeeklySessions: weeklySessions,
          preferredBatch: weeklySessions.map((item) => `${item.dayName}: ${item.sessionName} (${item.startTime}–${item.endTime})`).join(", "),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit your inquiry.");
      setStep(6);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Unable to submit your inquiry.");
    } finally { setSubmitting(false); }
  }

  return <main id="top" className="min-h-screen bg-(--background) text-(--foreground)">
    <header className="sticky top-0 z-40 border-b border-(--line) bg-(--card)/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <AcademyLogo className="h-11 w-11 shrink-0 rounded-xl border border-(--line) bg-white object-contain p-1" />
          <span className="min-w-0"><span className="block truncate font-bold">{academyName}</span><span className="block truncate text-xs text-(--ink-muted)">{academyTagline}</span></span>
        </Link>
        <Link href="/" className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-(--line) px-3 py-2 text-sm font-semibold hover:border-(--accent)"><ArrowLeft size={16}/><span className="hidden sm:inline">Home</span></Link>
      </div>
    </header>

    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-(--accent-soft) px-4 py-2 text-sm font-semibold text-(--accent)"><Sparkles size={16}/> Start your training journey</span>
        <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">{pageHeading}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-(--ink-muted) sm:text-base">Choose your program, plan, and weekly training preferences. Our team will follow up to confirm availability.</p>
      </div>

      {!loading && !loadError && <nav aria-label="Inquiry steps" className="mx-auto mt-7 max-w-5xl overflow-x-auto"><ol className="flex min-w-[650px] items-center justify-between gap-2">{["Program", "Plan", "Days & slots", "Confirm", "Inquiry", "Success"].map((label, index) => { const itemStep = index + 1; const active = step === itemStep; const complete = step > itemStep; return <li key={label} className="flex flex-1 items-center gap-2"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${active ? "bg-(--accent) text-white" : complete ? "bg-emerald-100 text-emerald-700" : "bg-(--surface) text-(--ink-faint)"}`}>{complete ? <CheckCircle2 size={16}/> : itemStep}</span><span className={`whitespace-nowrap text-xs font-semibold sm:text-sm ${active ? "text-(--foreground)" : "text-(--ink-faint)"}`}>{label}</span>{index < 5 && <span className={`h-px min-w-3 flex-1 ${complete ? "bg-emerald-300" : "bg-(--line)"}`}/>}</li>; })}</ol></nav>}

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-(--accent)"/></div> : loadError ? <Card className="mx-auto mt-8 max-w-xl p-6 text-center text-(--danger)">{loadError}</Card> : <>
        {step === 1 && <section className="mt-9" aria-labelledby="program-heading">
          <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Step 1</p><h2 id="program-heading" className="mt-1 text-xl font-bold">Select a program</h2></div></div>
          {programs.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => <button key={program._id} type="button" onClick={() => chooseCategory(program._id)} className="group rounded-2xl border border-(--line) bg-(--card) p-4 text-left transition hover:border-(--accent) hover:shadow-lg sm:p-5">
              <span className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)"><Dumbbell size={21}/></span><span className="min-w-0 flex-1"><span className="block font-bold">{program.name}</span><span className="mt-1 block text-xs text-(--ink-faint)">Training program</span></span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-(--accent-soft) text-(--accent) transition group-hover:bg-(--accent) group-hover:text-white"><ArrowRight size={17}/></span></span>
              {program.description && <span className="mt-2 block text-sm leading-5 text-(--ink-muted)">{program.description}</span>}
            </button>)}
          </div> : <Card className="p-6 text-center text-sm text-(--ink-muted)">No active programs are currently available.</Card>}
        </section>}

        {step === 2 && <section className="mt-9" aria-labelledby="plan-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Step 2</p><h2 id="plan-heading" className="mt-1 text-xl font-bold">Plans for {selectedPrograms.map((item) => item.name).join(", ")}</h2></div><Button variant="outline" onClick={goBackToPrograms}>Change programs</Button></div>
          {categoryPlans.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {categoryPlans.map((plan) => <Card key={plan._id} className={`flex h-full flex-col p-5 transition ${selectedPlan?._id === plan._id ? "border-(--accent) ring-2 ring-(--accent)/20" : ""}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Training plan</p><h3 className="mt-2 text-xl font-bold">{plan.name}</h3></div><span className="rounded-xl bg-(--accent-soft) p-2 text-(--accent)"><Dumbbell size={20}/></span></div>
              <p className="mt-4 text-2xl font-bold">{new Intl.NumberFormat("en-IN", { style: "currency", currency: settings.currency || "INR", maximumFractionDigits: 0 }).format(Number(plan.price || 0))}<span className="ml-1 text-sm font-medium text-(--ink-muted)">/ {plan.duration} {plan.durationUnit === "DAYS" ? "days" : plan.duration === 1 ? "month" : "months"}</span></p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-(--line) px-3 py-1.5">{plan.classesPerWeek} classes / week</span><span className="rounded-full border border-(--line) px-3 py-1.5">Starting {plan.startingBelt || "Beginner"}</span></div>
              <p className="mt-4 text-sm text-(--ink-muted)">Includes: {plan.programs?.map(getProgramName).join(", ") || "No programs assigned"}</p>
              <Button type="button" variant={selectedPlan?._id === plan._id ? "secondary" : "outline"} className="mt-5 w-full" onClick={() => choosePlan(plan)}>{selectedPlan?._id === plan._id ? "Plan selected" : "Choose this plan"}<ArrowRight size={16}/></Button>
            </Card>)}
          </div> : <Card className="p-6 text-center text-sm text-(--ink-muted)">There are no active plans linked to all selected programs.</Card>}
        </section>}

        {step === 3 && selectedPlan && <section className="mt-9" aria-labelledby="schedule-heading">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Step 3</p><h2 id="schedule-heading" className="mt-1 text-xl font-bold">Choose {selectedPlan.classesPerWeek} weekly training days and sessions</h2><p className="mt-1 text-sm text-(--ink-muted)">Select one matching session on each of {selectedPlan.classesPerWeek} different days.</p></div><Button type="button" variant="outline" onClick={goBackToPlans}>Change plan</Button></div>
            <PublicPlanWeeklySchedule planProgramIds={selectedProgramIds} programWeeklyLimits={programWeeklyLimits} selectionLimit={selectedPlan.classesPerWeek} value={weeklySessions} onChange={(selectedBranch, choices) => { setBranch(selectedBranch); setWeeklySessions(choices); }} />
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><p className={`text-sm font-semibold ${weeklySessions.length === selectedPlan.classesPerWeek ? "text-emerald-700" : "text-(--ink-muted)"}`}>{weeklySessions.length === selectedPlan.classesPerWeek ? `✓ Selected ${weeklySessions.length} of ${selectedPlan.classesPerWeek} classes` : `Select ${selectedPlan.classesPerWeek - weeklySessions.length} more ${selectedPlan.classesPerWeek - weeklySessions.length === 1 ? "class" : "classes"}`}</p><Button type="button" disabled={!branch || weeklySessions.length !== selectedPlan.classesPerWeek} onClick={continueToForm}>Review selection<ArrowRight size={16}/></Button></div>
          </Card>
        </section>}

        {step === 4 && selectedPlan && <section className="mt-9" aria-labelledby="confirm-heading">
          <Card className="mx-auto max-w-3xl p-5 sm:p-8">
            <button type="button" onClick={() => setStep(3)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted) hover:text-(--accent)"><ArrowLeft size={16}/>Change schedule</button>
            <p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Step 4</p><h2 id="confirm-heading" className="mt-1 text-2xl font-bold">Confirm your selection</h2><p className="mt-1 text-sm text-(--ink-muted)">Review your chosen program, plan, branch, and weekly sessions.</p>
            <SelectionSummary programs={selectedPrograms.map((item) => item.name)} plan={selectedPlan} branchName={branch?.name || ""} sessions={weeklySessions} currency={settings.currency}/>
            <Button className="mt-6 w-full" onClick={continueToInquiryForm}>Continue to inquiry form<ArrowRight size={16}/></Button>
          </Card>
        </section>}

        {step === 5 && selectedPlan && <section id="inquiry-form" className="scroll-mt-24 mt-9">
          <Card className="mx-auto max-w-3xl p-5 sm:p-8">
              <button type="button" onClick={() => setStep(4)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-(--ink-muted) hover:text-(--accent)"><ArrowLeft size={16}/>Change selection</button>
              <div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-(--accent)">Step 5</p><h2 className="mt-1 text-2xl font-bold">Send your inquiry</h2><p className="mt-1 text-sm text-(--ink-muted)">Share your details and our team will contact you soon.</p></div>
              {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <SelectionSummary programs={selectedPrograms.map((item) => item.name)} plan={selectedPlan} branchName={branch?.name || ""} sessions={weeklySessions} currency={settings.currency}/>
              <form onSubmit={submitInquiry} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name *<input required minLength={2} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} autoComplete="name" className="mt-2 w-full rounded-xl border border-(--line) bg-(--input-bg) px-4 py-3 font-normal outline-none focus:border-(--accent)" placeholder="Your name"/></label>
                  <label className="text-sm font-semibold">Email address *<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" className="mt-2 w-full rounded-xl border border-(--line) bg-(--input-bg) px-4 py-3 font-normal outline-none focus:border-(--accent)" placeholder="you@example.com"/></label></div>
                <div><label className="mb-2 block text-sm font-semibold">Phone number *</label><InternationalPhoneInput value={form.phone} onChange={(phone) => setForm((previous) => ({ ...previous, phone }))} required /></div>
                <label className="block text-sm font-semibold">Message <span className="font-normal text-(--ink-muted)">(optional)</span><textarea rows={4} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} maxLength={2000} className="mt-2 w-full resize-y rounded-xl border border-(--line) bg-(--input-bg) px-4 py-3 font-normal outline-none focus:border-(--accent)" placeholder="Anything you’d like us to know?"/></label>
                <Button type="submit" disabled={submitting || !selectedPlan || !categoryIds.length} className="w-full">{submitting ? <><Loader2 className="animate-spin" size={16}/>Sending inquiry…</> : <>Send inquiry<ArrowRight size={16}/></>}</Button>
                <p className="text-center text-xs text-(--ink-faint)">Weekly schedule selections are preferences only and do not reserve classes.</p>
              </form>
          </Card>
        </section>}

        {step === 6 && selectedPlan && <section className="mt-9"><Card className="mx-auto max-w-2xl px-6 py-12 text-center sm:px-10"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={48}/></span><p className="mt-6 text-xs font-bold uppercase tracking-widest text-emerald-700">Inquiry submitted</p><h2 className="mt-2 text-3xl font-bold">Thank you, {form.fullName.trim()}!</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-(--ink-muted)">Your inquiry and weekly training preferences have been sent. Our team will contact you to discuss the plan and confirm suitable sessions.</p><Button variant="outline" className="mt-7" onClick={() => router.push("/")}>Back to home<ArrowRight size={16}/></Button></Card></section>}
      </>}
    </section>
    <footer className="border-t border-(--line) bg-(--card) px-4 py-6 text-center text-sm text-(--ink-muted)">{academyName} · {academyTagline}</footer>
  </main>;
}
