"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState, type ChangeEvent } from "react";
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
  XCircle,
} from "lucide-react";

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

export default function InquiryPage() {
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [plansError, setPlansError] = useState("");

  const fetchPublicPlans = async () => {
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

      setPlans(data.plans || []);
    } catch (fetchError) {
      console.error("Fetch public plans error:", fetchError);

      setPlansError(
        fetchError instanceof Error
          ? fetchError.message
          : "Unable to load training plans.",
      );
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchPublicPlans();
  }, []);

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!formData.fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!formData.email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (formData.phone.trim().length < 10) {
      setError("Please enter a valid phone number.");
      return;
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
          age: formData.age ? Number(formData.age) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit enquiry.");
      }

      setSubmitted(true);
      setFormData(initialFormData);

      await fetchPublicPlans();

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (submitError) {
      console.error("Inquiry submission error:", submitError);

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (plan: Plan) => {
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
    <main id="top" className="min-h-screen bg-[#f5f7fb] text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b1020] text-[#f59e0b]">
              <Image
                src="/logo.png"
                alt="DojoFlow logo"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md object-contain"
              />
            </div>

            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">
                DojoFlow
              </p>

              <p className="text-xs text-slate-500">Karate Academy</p>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-slate-100 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            {/* Left Content */}
            <div className="lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
                <Sparkles className="h-4 w-4" />
                Start your karate journey
              </div>

              <h1 className="mt-6 max-w-xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Train with discipline.
                <span className="mt-2 block text-orange-500">
                  Grow with confidence.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600">
                Tell us a little about yourself. Our academy team will contact
                you with suitable programs, batch timings and admission
                information.
              </p>

              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <div key={benefit.title} className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-slate-950">
                          {benefit.title}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Process Card */}
              <div className="mt-10 rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
                <p className="text-sm font-bold text-slate-950">
                  What happens next?
                </p>

                <div className="mt-5 space-y-4">
                  {[
                    "Submit your enquiry",
                    "Our team reviews your details",
                    "Receive suitable batch and plan information",
                  ].map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b1020] text-xs font-bold text-white">
                        {index + 1}
                      </span>

                      <span className="text-sm text-slate-600">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Inquiry Form */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
              {!submitted ? (
                <>
                  <div className="border-b border-slate-100 px-6 py-6 sm:px-8">
                    <div className="flex items-start justify-between gap-5">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                          Student enquiry
                        </p>

                        <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                          Tell us about yourself
                        </h2>

                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          Fill in the details below and our academy team will
                          get in touch with you.
                        </p>
                      </div>

                      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0b1020] text-orange-400 sm:flex">
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
                    <div className="grid gap-5 sm:grid-cols-2">
                      {/* Full Name */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="fullName"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Full Name *
                        </label>

                        <input
                          id="fullName"
                          name="fullName"
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={handleChange}
                          placeholder="Enter your full name"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label
                          htmlFor="email"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Email Address *
                        </label>

                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label
                          htmlFor="phone"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Phone Number *
                        </label>

                        <div className="relative">
                          <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            id="phone"
                            name="phone"
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="Enter phone number"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                      </div>

                      {/* Age */}
                      <div>
                        <label
                          htmlFor="age"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Age
                        </label>

                        <input
                          id="age"
                          name="age"
                          type="number"
                          min="3"
                          max="100"
                          value={formData.age}
                          onChange={handleChange}
                          placeholder="Enter age"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>

                      {/* Current Belt */}
                      <div>
                        <label
                          htmlFor="currentBelt"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Current Belt / Rank
                        </label>

                        <select
                          id="currentBelt"
                          name="currentBelt"
                          value={formData.currentBelt}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        >
                          {beltOptions.map((belt) => (
                            <option key={belt} value={belt}>
                              {belt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Experience */}
                      <div>
                        <label
                          htmlFor="experience"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Previous Experience
                        </label>

                        <select
                          id="experience"
                          name="experience"
                          value={formData.experience}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        >
                          <option value="">Select experience</option>

                          {experienceOptions.map((experience) => (
                            <option key={experience} value={experience}>
                              {experience}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Preferred Batch */}
                      <div>
                        <label
                          htmlFor="preferredBatch"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Preferred Batch
                        </label>

                        <select
                          id="preferredBatch"
                          name="preferredBatch"
                          value={formData.preferredBatch}
                          onChange={handleChange}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        >
                          <option value="">Select timing</option>

                          {batchOptions.map((batch) => (
                            <option key={batch} value={batch}>
                              {batch}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Preferred Branch */}
                      <div>
                        <label
                          htmlFor="preferredBranch"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Preferred Branch / Location
                        </label>

                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                          <input
                            id="preferredBranch"
                            name="preferredBranch"
                            type="text"
                            value={formData.preferredBranch}
                            onChange={handleChange}
                            placeholder="Enter preferred location"
                            className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                          />
                        </div>
                      </div>

                      {/* Message */}
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="message"
                          className="mb-2 block text-sm font-semibold text-slate-700"
                        >
                          Additional Message
                        </label>

                        <textarea
                          id="message"
                          name="message"
                          rows={4}
                          value={formData.message}
                          onChange={handleChange}
                          placeholder="Tell us anything else you would like us to know..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1020] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                    </button>

                    <p className="text-center text-xs leading-5 text-slate-400">
                      By submitting this form, you agree to be contacted by the
                      academy team regarding training and admission.
                    </p>
                  </form>
                </>
              ) : (
                <div className="px-6 py-16 text-center sm:px-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>

                  <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                    Enquiry received
                  </p>

                  <h2 className="mt-3 text-3xl font-bold text-slate-950">
                    Thank you for reaching out!
                  </h2>

                  <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-500">
                    Your enquiry has been submitted successfully. Our academy
                    team will contact you soon with suitable training options,
                    batch timings and admission details.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setError("");
                    }}
                    className="mt-8 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                  >
                    Submit Another Enquiry
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Public Plans Section */}
      <section className="border-b border-slate-200 bg-[#f5f7fb]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700">
              <Dumbbell className="h-4 w-4" />
              Active training plans
            </div>

            <h2 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Choose a plan that fits your goals
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              These plans are fetched directly from the academy system. Only
              currently active plans are displayed.
            </p>
          </div>

          {isLoadingPlans ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />

              <p className="mt-4 text-sm text-slate-500">
                Loading active plans...
              </p>
            </div>
          ) : plansError ? (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <XCircle className="mx-auto h-8 w-8 text-red-500" />

              <h3 className="mt-3 font-semibold text-red-900">
                Unable to load plans
              </h3>

              <p className="mt-2 text-sm text-red-700">{plansError}</p>

              <button
                type="button"
                onClick={fetchPublicPlans}
                className="mt-5 rounded-xl bg-[#0b1020] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Try Again
              </button>
            </div>
          ) : plans.length === 0 ? (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Dumbbell className="mx-auto h-10 w-10 text-slate-400" />

              <h3 className="mt-4 text-lg font-semibold text-slate-950">
                No active plans available
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Our current training plans are not available at the moment.
                Please submit an enquiry and our team will share the latest
                options with you.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan._id}
                  className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-slate-200/70 sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
                        Training plan
                      </p>

                      <h3 className="mt-3 text-2xl font-bold text-slate-950">
                        {plan.name}
                      </h3>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b1020] text-orange-400 transition group-hover:bg-orange-500 group-hover:text-white">
                      <Dumbbell className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-8">
                    <span className="text-4xl font-bold tracking-tight text-slate-950">
                      ₹{plan.price.toLocaleString("en-IN")}
                    </span>

                    <span className="ml-2 text-sm text-slate-500">
                      / {formatDuration(plan)}
                    </span>
                  </div>

                  <div className="mt-8 space-y-4 border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-500">Classes per week</span>

                      <span className="font-semibold text-slate-950">
                        {plan.classesPerWeek}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-500">Starting belt</span>

                      <span className="font-semibold text-slate-950">
                        {plan.startingBelt}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span className="text-slate-500">Progress reports</span>

                      <span className="text-right font-semibold text-slate-950">
                        {plan.progressReports}
                      </span>
                    </div>
                  </div>

                  {plan.milestones && plan.milestones.length > 0 && (
                    <div className="mt-8 border-t border-slate-100 pt-6">
                      <h4 className="text-sm font-bold text-slate-950">
                        Key milestones
                      </h4>

                      <ul className="mt-4 space-y-3">
                        {plan.milestones.slice(0, 4).map((milestone, index) => (
                          <li
                            key={`${milestone.title}-${index}`}
                            className="flex items-start gap-2 text-sm text-slate-600"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                            <span>{milestone.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <a
                    href="#top"
                    className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
                  >
                    Enquire about this plan
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#0b1020]">
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:px-8 lg:py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white">
            <Sparkles className="h-7 w-7" />
          </div>

          <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to begin your journey?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            Submit your enquiry and our team will help you find the right
            program, schedule and admission option.
          </p>

          <a
            href="#top"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Submit an Enquiry
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-slate-950">
              DojoFlow Karate Academy
            </p>

            <p className="mt-1">Train with discipline. Grow with confidence.</p>
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
