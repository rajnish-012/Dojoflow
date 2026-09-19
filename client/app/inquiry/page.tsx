"use client";

import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { Button, Card, Input, Select } from "@/components/ui";

type FormData = {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  currentBelt: string;
  experience: string;
  preferredBatch: string;
  preferredBranch: string;
  message: string;
};

type Plan = {
  _id: string;
  name: string;
  price: number;
  duration: number;
  durationUnit: "MONTHS" | "DAYS";
  classesPerWeek: number;
  startingBelt: string;
  progressReports: string;
  milestones?: {
    title: string;
    description?: string;
  }[];
  curriculum?: {
    title: string;
    description?: string;
  }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const initialFormData: FormData = {
  fullName: "",
  email: "",
  phone: "",
  age: "",
  currentBelt: "Beginner",
  experience: "",
  preferredBatch: "",
  preferredBranch: "",
  message: "",
};

const benefits = [
  {
    icon: ShieldCheck,
    title: "Safe and structured training",
    description:
      "Learn karate in a disciplined, supportive and professional environment.",
  },
  {
    icon: Clock3,
    title: "Flexible batch timings",
    description:
      "Choose a preferred morning, afternoon or evening training schedule.",
  },
  {
    icon: UserRound,
    title: "Training for every level",
    description:
      "Programs are available for beginners, intermediate and advanced students.",
  },
  {
    icon: MapPin,
    title: "Branch-based learning",
    description:
      "Share your preferred location and our team will guide you accordingly.",
  },
];

const beltOptions = [
  "Beginner",
  "White Belt",
  "Yellow Belt",
  "Orange Belt",
  "Green Belt",
  "Blue Belt",
  "Brown Belt",
  "Black Belt",
];

const experienceOptions = [
  "No experience",
  "Less than 1 year",
  "1–3 years",
  "More than 3 years",
];

const batchOptions = ["Morning", "Afternoon", "Evening", "Flexible"];

function FieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-semibold text-(--foreground)"
    >
      {children}
      {required && (
        <span className="ml-1 text-(--accent)" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

function Notice({
  type,
  message,
  onClose,
}: {
  type: "error" | "success";
  message: string;
  onClose: () => void;
}) {
  const isError = type === "error";

  return (
    <div
      role="alert"
      className={`mb-6 flex items-start justify-between gap-4 rounded-2xl border p-4 ${
        isError
          ? "border-(--danger) bg-(--danger-soft) text-(--danger)"
          : "border-(--green) bg-(--green-soft) text-(--green)"
      }`}
    >
      <div className="flex items-start gap-3">
        {isError ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        )}
        <p className="text-sm font-medium">{message}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="rounded-lg p-1 transition hover:bg-(--hover-bg)"
        aria-label="Dismiss message"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const formatDuration = () => {
    const unit =
      plan.duration === 1
        ? plan.durationUnit === "MONTHS"
          ? "month"
          : "day"
        : plan.durationUnit === "MONTHS"
          ? "months"
          : "days";

    return `${plan.duration} ${unit}`;
  };

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:border-(--accent) hover:shadow-[0_20px_50px_var(--shadow-color)]">
      <div className="border-b border-(--line) p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-(--accent)">
              Training plan
            </span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-(--foreground)">
              {plan.name}
            </h3>
          </div>

          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-(--sidebar-logo-bg) text-(--gold) transition group-hover:bg-(--gold) group-hover:text-(--sidebar-active-text)">
            <Image
              src="/logo.png"
              alt="DojoFlow logo"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md object-contain"
            />
          </div>
        </div>

        <div className="mt-7 flex items-end gap-2">
          <span className="text-4xl font-bold tracking-tight text-(--foreground)">
            ₹{Number(plan.price || 0).toLocaleString("en-IN")}
          </span>
          <span className="pb-1 text-sm text-(--ink-muted)">
            / {formatDuration()}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-(--ink-muted)">Classes per week</span>
            <span className="font-semibold text-(--foreground)">
              {plan.classesPerWeek}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-(--ink-muted)">Starting belt</span>
            <span className="font-semibold text-(--foreground)">
              {plan.startingBelt}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-(--ink-muted)">Progress reports</span>
            <span className="text-right font-semibold text-(--foreground)">
              {plan.progressReports}
            </span>
          </div>
        </div>

        {plan.milestones && plan.milestones.length > 0 && (
          <div className="mt-7 border-t border-(--line) pt-6">
            <h4 className="text-sm font-bold text-(--foreground)">
              Key milestones
            </h4>
            <ul className="mt-4 space-y-3">
              {plan.milestones.slice(0, 4).map((milestone, index) => (
                <li
                  key={`${milestone.title}-${index}`}
                  className="flex items-start gap-2 text-sm text-(--ink-muted)"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-(--gold)" />
                  <span>{milestone.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href="#inquiry-form"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl border border-(--line) bg-(--surface) px-4 py-3 text-sm font-semibold text-(--foreground) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent)"
        >
          Enquire about this plan
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}

export default function InquiryPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [plansError, setPlansError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    phone?: string;
    age?: string;
  }>({});

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function fetchPublicPlans() {
    setIsLoadingPlans(true);
    setPlansError("");

    try {
      const response = await fetch(`${API_URL}/plans/public`, {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load training plans.");
      }

      setPlans(Array.isArray(data.plans) ? data.plans : []);
    } catch (fetchError: unknown) {
      console.error("Fetch public plans error:", fetchError);
      setPlansError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load training plans.",
      );
    } finally {
      setIsLoadingPlans(false);
    }
  }

  useEffect(() => {
    void fetchPublicPlans();
  }, []);

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleEmailBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((previous) => ({ ...previous, email: undefined }));
      return;
    }

    setFieldErrors((previous) => ({
      ...previous,
      email: emailPattern.test(value)
        ? undefined
        : "Please enter a valid email address.",
    }));
  }

  function handlePhoneBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((previous) => ({ ...previous, phone: undefined }));
      return;
    }

    setFieldErrors((previous) => ({
      ...previous,
      phone: /^[0-9]{10}$/.test(value)
        ? undefined
        : "Phone number must be exactly 10 digits.",
    }));
  }

  function handleAgeBlur(event: React.FocusEvent<HTMLInputElement>) {
    const value = event.target.value.trim();

    if (!value) {
      setFieldErrors((previous) => ({ ...previous, age: undefined }));
      return;
    }

    const numericAge = Number(value);
    const isValid =
      Number.isInteger(numericAge) && numericAge >= 3 && numericAge <= 100;

    setFieldErrors((previous) => ({
      ...previous,
      age: isValid ? undefined : "Age must be between 3 and 100.",
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmedName = formData.fullName.trim();
    const trimmedEmail = formData.email.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedName) {
      setError("Please enter your full name.");
      return;
    }

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!emailPattern.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!trimmedPhone) {
      setError("Please enter your phone number.");
      return;
    }

    const phonePattern = /^[0-9]{10}$/;

    if (!phonePattern.test(trimmedPhone)) {
      setError(
        "Please enter a valid 10-digit phone number (numbers only).",
      );
      return;
    }

    if (formData.age.trim()) {
      const numericAge = Number(formData.age);

      if (
        !Number.isInteger(numericAge) ||
        numericAge < 3 ||
        numericAge > 100
      ) {
        setError("Please enter a valid age between 3 and 100.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/inquiries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          fullName: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          age: formData.age ? Number(formData.age) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit enquiry.");
      }

      setSubmitted(true);
      setFormData(initialFormData);
      setFieldErrors({});
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError: unknown) {
      console.error("Inquiry submission error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      id="top"
      className="min-h-screen bg-(--background) text-(--foreground) transition-colors duration-300"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-(--line) bg-(--card) backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--sidebar-logo-bg) text-(--gold)">
              <Image
                src="/logo.png"
                alt="DojoFlow logo"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md object-contain"
              />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-(--foreground)">
                DojoFlow
              </p>
              <p className="text-xs text-(--ink-muted)">Karate Academy</p>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-(--line) bg-(--surface) px-4 py-2.5 text-sm font-semibold text-(--foreground) transition hover:border-(--accent) hover:bg-(--accent-soft) hover:text-(--accent)"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Home</span>
          </Link>
        </div>
      </header>

      {/* Hero + Form */}
      <section className="relative overflow-hidden border-b border-(--line) bg-(--card)">
        <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-(--accent-soft) blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-16 h-96 w-96 rounded-full bg-(--surface) blur-3xl" />

        <div className="relative mx-auto w-full max-w-[1440px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--accent-soft) px-4 py-2 text-sm font-semibold text-(--accent)">
                <Sparkles className="h-4 w-4" />
                Start your karate journey
              </div>

              <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight tracking-tight text-(--foreground) sm:text-5xl lg:text-6xl">
                Train with discipline.
                <span className="mt-2 block text-(--gold)">
                  Grow with confidence.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-(--ink-muted)">
                Tell us a little about yourself. Our academy team will contact
                you with suitable programs, batch timings and admission
                information.
              </p>

              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={benefit.title} className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-(--line) bg-(--accent-soft) text-(--accent)">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-(--foreground)">
                          {benefit.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-(--ink-muted)">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Card className="mt-10 p-5">
                <p className="text-sm font-bold text-(--foreground)">
                  What happens next?
                </p>
                <div className="mt-5 space-y-4">
                  {[
                    "Submit your enquiry",
                    "Our team reviews your details",
                    "Receive suitable batch and plan information",
                  ].map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--sidebar-logo-bg) text-xs font-bold text-(--gold)">
                        {index + 1}
                      </span>
                      <span className="text-sm text-(--ink-muted)">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card
              id="inquiry-form"
              className="overflow-hidden p-0 shadow-[0_20px_60px_var(--shadow-color)]"
            >
              {!submitted ? (
                <>
                  <div className="border-b border-(--line) px-6 py-6 sm:px-8">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-(--accent)">
                          Student enquiry
                        </p>
                        <h2 className="mt-2 text-2xl font-bold text-(--foreground) sm:text-3xl">
                          Tell us about yourself
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-(--ink-muted)">
                          Fill in the details below and our academy team will
                          get in touch with you.
                        </p>
                      </div>

                      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--sidebar-logo-bg) text-(--gold) sm:flex">
                        <Image
                          src="/logo.png"
                          alt="DojoFlow logo"
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-md object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-6 px-6 py-7 sm:px-8"
                  >
                    {error && (
                      <Notice
                        type="error"
                        message={error}
                        onClose={() => setError("")}
                      />
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="fullName" required>
                          Full Name
                        </FieldLabel>
                        <Input
                          id="fullName"
                          name="fullName"
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Enter your full name"
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="email" required>
                          Email Address
                        </FieldLabel>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          onBlur={handleEmailBlur}
                          placeholder="you@example.com"
                        />
                        {fieldErrors.email && (
                          <p className="mt-1.5 text-xs font-medium text-(--danger)">
                            {fieldErrors.email}
                          </p>
                        )}
                      </div>

                      <div>
                        <FieldLabel htmlFor="phone" required>
                          Phone Number
                        </FieldLabel>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]{10}"
                          maxLength={10}
                          required
                          value={formData.phone}
                          onChange={(event) => {
                            const digitsOnly = event.target.value.replace(
                              /\D/g,
                              "",
                            );

                            setFormData((previous) => ({
                              ...previous,
                              phone: digitsOnly,
                            }));
                          }}
                          onBlur={handlePhoneBlur}
                          placeholder="10-digit phone number"
                        />
                        {fieldErrors.phone && (
                          <p className="mt-1.5 text-xs font-medium text-(--danger)">
                            {fieldErrors.phone}
                          </p>
                        )}
                      </div>

                      <div>
                        <FieldLabel htmlFor="age">Age</FieldLabel>
                        <Input
                          id="age"
                          name="age"
                          type="text"
                          inputMode="numeric"
                          maxLength={3}
                          value={formData.age}
                          onChange={(event) => {
                            const digitsOnly = event.target.value.replace(
                              /\D/g,
                              "",
                            );

                            setFormData((previous) => ({
                              ...previous,
                              age: digitsOnly,
                            }));
                          }}
                          onBlur={handleAgeBlur}
                          placeholder="Enter age"
                        />
                        {fieldErrors.age && (
                          <p className="mt-1.5 text-xs font-medium text-(--danger)">
                            {fieldErrors.age}
                          </p>
                        )}
                      </div>

                      <div>
                        <FieldLabel htmlFor="currentBelt">
                          Current Belt / Rank
                        </FieldLabel>
                        <Select
                          id="currentBelt"
                          name="currentBelt"
                          value={formData.currentBelt}
                          onChange={handleChange}
                        >
                          {beltOptions.map((belt) => (
                            <option key={belt} value={belt}>
                              {belt}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <FieldLabel htmlFor="experience">
                          Previous Experience
                        </FieldLabel>
                        <Select
                          id="experience"
                          name="experience"
                          value={formData.experience}
                          onChange={handleChange}
                        >
                          <option value="">Select experience</option>
                          {experienceOptions.map((experience) => (
                            <option key={experience} value={experience}>
                              {experience}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <FieldLabel htmlFor="preferredBatch">
                          Preferred Batch
                        </FieldLabel>
                        <Select
                          id="preferredBatch"
                          name="preferredBatch"
                          value={formData.preferredBatch}
                          onChange={handleChange}
                        >
                          <option value="">Select timing</option>
                          {batchOptions.map((batch) => (
                            <option key={batch} value={batch}>
                              {batch}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div>
                        <FieldLabel htmlFor="preferredBranch">
                          Preferred Branch / Location
                        </FieldLabel>
                        <Input
                          id="preferredBranch"
                          name="preferredBranch"
                          type="text"
                          value={formData.preferredBranch}
                          onChange={handleChange}
                          placeholder="Enter preferred location"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="message">
                          Additional Message
                        </FieldLabel>
                        <textarea
                          id="message"
                          name="message"
                          rows={4}
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us anything else you would like us to know..."
                          className="w-full resize-none rounded-xl border border-(--line) bg-(--input-bg) px-4 py-3.5 text-sm text-(--foreground) outline-none transition placeholder:text-(--ink-faint) focus:border-(--gold) focus:ring-4 focus:ring-(--gold)/10"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      fullWidth
                      className="bg-(--sidebar-logo-bg) text-(--gold) hover:bg-(--gold) hover:text-(--sidebar-active-text)"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting enquiry...
                        </>
                      ) : (
                        <>
                          Submit Enquiry
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-xs leading-5 text-(--ink-faint)">
                      By submitting this form, you agree to be contacted by the
                      academy team regarding training and admission.
                    </p>
                  </form>
                </>
              ) : (
                <div className="px-6 py-16 text-center sm:px-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-(--green-soft) text-(--green)">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>

                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-(--green)">
                    Enquiry received
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-(--foreground)">
                    Thank you for reaching out!
                  </h2>

                  <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-(--ink-muted)">
                    Your enquiry has been submitted successfully. Our academy
                    team will contact you soon with suitable training options,
                    batch timings and admission details.
                  </p>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSubmitted(false);
                      setError("");
                    }}
                    className="mx-auto mt-8"
                  >
                    Submit Another Enquiry
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="border-b border-(--line) bg-(--background)">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--accent-soft) px-4 py-2 text-sm font-semibold text-(--accent)">
              <Dumbbell className="h-4 w-4" />
              Active training plans
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight text-(--foreground) sm:text-4xl">
              Choose a plan that fits your goals
            </h2>
            <p className="mt-4 text-sm leading-7 text-(--ink-muted)">
              These plans are fetched directly from the academy system. Only
              currently active plans are displayed.
            </p>
          </div>

          {isLoadingPlans ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-(--gold)" />
              <p className="mt-4 text-sm text-(--ink-muted)">
                Loading active plans...
              </p>
            </div>
          ) : plansError ? (
            <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
              <XCircle className="mx-auto h-8 w-8 text-(--danger)" />
              <h3 className="mt-3 font-semibold text-(--foreground)">
                Unable to load plans
              </h3>
              <p className="mt-2 text-sm text-(--ink-muted)">{plansError}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void fetchPublicPlans()}
                className="mx-auto mt-5"
              >
                Try Again
              </Button>
            </Card>
          ) : plans.length === 0 ? (
            <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
                <Dumbbell className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-(--foreground)">
                No active plans available
              </h3>
              <p className="mt-2 text-sm leading-6 text-(--ink-muted)">
                Our current training plans are not available at the moment.
                Please submit an enquiry and our team will share the latest
                options with you.
              </p>
            </Card>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard key={plan._id} plan={plan} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-(--sidebar-logo-bg)">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-(--gold) text-(--sidebar-active-text)">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to begin your journey?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70">
            Submit your enquiry and our team will help you find the right
            program, schedule and admission option.
          </p>
          <a
            href="#inquiry-form"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-(--gold) px-6 py-3.5 text-sm font-semibold text-(--sidebar-active-text) transition hover:opacity-90"
          >
            Submit an Enquiry
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-(--line) bg-(--card)">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 text-sm text-(--ink-muted) sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--sidebar-logo-bg)">
              <Image
                src="/logo.png"
                alt="DojoFlow logo"
                width={24}
                height={24}
                className="h-6 w-6 rounded-md object-contain"
              />
            </div>
            <div>
              <p className="font-semibold text-(--foreground)">
                DojoFlow Karate Academy
              </p>
              <p className="mt-1">
                Train with discipline. Grow with confidence.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Academy support
            </span>
            <span className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Admission assistance
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}