"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  Menu,
  ShieldCheck,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";

const navItems = [
  { label: "About", href: "#about" },
  { label: "Programs", href: "#programs" },
  { label: "Features", href: "#features" },
  { label: "Journey", href: "#journey" },
];

const programs = [
  {
    title: "Beginner Karate",
    subtitle: "Build your foundation",
    description:
      "Learn basic stances, movements, discipline and karate techniques in a structured environment.",
    icon: ShieldCheck,
    level: "White Belt",
  },
  {
    title: "Intermediate Training",
    subtitle: "Develop your skills",
    description:
      "Improve your technique, combinations, flexibility and confidence through focused training.",
    icon: Target,
    level: "Yellow to Green Belt",
  },
  {
    title: "Advanced Karate",
    subtitle: "Master your potential",
    description:
      "Refine advanced techniques, sparring, leadership and preparation for higher belt levels.",
    icon: Trophy,
    level: "Blue Belt and Above",
  },
];

const features = [
  {
    icon: Users,
    title: "Expert Coaching",
    description:
      "Train under experienced coaches who focus on technique, discipline and individual growth.",
  },
  {
    icon: Target,
    title: "Structured Training",
    description:
      "Follow a clear curriculum designed to help students progress confidently from one belt to the next.",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    description:
      "Track attendance, performance, milestones and belt progression throughout your journey.",
  },
  {
    icon: Award,
    title: "Achievement Focused",
    description:
      "Celebrate every milestone and stay motivated with visible progress and meaningful goals.",
  },
];

const journey = [
  {
    number: "01",
    title: "Start Your Journey",
    description:
      "Submit an enquiry and discover the right training program for your goals.",
  },
  {
    number: "02",
    title: "Learn the Fundamentals",
    description:
      "Build strong foundations through regular classes, discipline and guided practice.",
  },
  {
    number: "03",
    title: "Grow with Every Class",
    description:
      "Improve your skills, confidence, fitness and understanding of karate.",
  },
  {
    number: "04",
    title: "Earn Your Next Belt",
    description:
      "Progress through structured evaluations and achieve your next milestone.",
  },
];

const stats = [
  ["4+", "Training levels"],
  ["100%", "Progress focused"],
  ["1", "Clear training journey"],
  ["∞", "Room to grow"],
];

const benefits = [
  [Dumbbell, "Physical Fitness"],
  [Target, "Mental Focus"],
  [ShieldCheck, "Self Discipline"],
  [Users, "Strong Community"],
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#080b16] text-white">
      <Header
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        closeMenu={closeMenu}
      />

      {/* Hero */}
      <section className="relative isolate min-h-screen overflow-hidden pt-20">
        <div className="absolute inset-0 -z-20 bg-[#080b16]" />
        <div className="absolute -right-40 top-24 -z-10 h-[520px] w-[520px] rounded-full bg-red-600/20 blur-[120px]" />
        <div className="absolute -left-40 bottom-0 -z-10 h-[420px] w-[420px] rounded-full bg-orange-600/10 blur-[120px]" />
        <div className="absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:60px_60px]" />

        <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-14 px-6 py-20 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-24">
          <div>
            <Badge />

            <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Build strength.
              <br />
              <span className="text-red-500">Master yourself.</span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              Discover a stronger, more disciplined version of yourself
              through structured karate training, expert coaching and a
              community that helps you grow.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="/inquiry">
                Start Your Journey
              </PrimaryButton>

              <a
                href="#programs"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                Explore Training
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-4 text-sm text-slate-400">
              {["All skill levels", "Expert guidance", "Structured progress"].map(
                (item) => (
                  <span key={item} className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-400" />
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 px-6 sm:grid-cols-4 lg:px-8">
          {stats.map(([value, label]) => (
            <Stat key={label} value={value} label={label} />
          ))}
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="scroll-mt-24 bg-white py-24 text-slate-950 sm:py-32"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
          <SectionTitle
            eyebrow="More than a workout"
            title="Karate is a journey of becoming."
          />

          <div>
            <p className="text-lg leading-8 text-slate-600">
              At DojoFlow Karate Academy, training is about more than
              physical fitness. Every class develops discipline, confidence,
              focus and respect while helping students build practical
              martial arts skills.
            </p>

            <p className="mt-6 text-lg leading-8 text-slate-600">
              Whether you are stepping onto the mat for the first time or
              preparing for your next belt, our structured approach helps you
              progress with purpose.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {benefits.map(([Icon, text]) => (
                <Pill key={text} icon={Icon as LucideIcon} text={text as string} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section
        id="programs"
        className="scroll-mt-24 bg-slate-50 py-24 text-slate-950 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <SectionTitle
              eyebrow="Training programs"
              title="Find your place on the mat."
            />

            <p className="max-w-md text-sm leading-7 text-slate-500">
              Every program is designed to help you develop the right skills
              at the right stage of your karate journey.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {programs.map((program) => (
              <ProgramCard key={program.title} program={program} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-24 bg-[#080b16] py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <SectionTitle
            eyebrow="Why train with us"
            title={
              <>
                A stronger body.
                <br />
                A sharper mind.
              </>
            }
            description="Our training environment combines traditional karate values with a modern, structured approach to student development."
          />

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Journey */}
      <section
        id="journey"
        className="scroll-mt-24 bg-white py-24 text-slate-950 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <SectionTitle
              eyebrow="Your journey"
              title="Progress with purpose."
              description="Every great martial artist begins with one step. Follow a structured path and keep growing with every class."
              center
            />
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {journey.map((item) => (
              <div
                key={item.number}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <span className="text-sm font-black text-red-600">
                  {item.number}
                </span>

                <h3 className="mt-6 text-xl font-black">{item.title}</h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTA />
      <Footer />
    </main>
  );
}

/* ---------------- Components ---------------- */

function Header({
  mobileMenuOpen,
  setMobileMenuOpen,
  closeMenu,
}: {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (value: boolean) => void;
  closeMenu: () => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#080b16]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Logo />

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            Academy Login
          </Link>

          <PrimaryButton href="/inquiry" small>
            Join the Academy
          </PrimaryButton>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg border border-white/10 p-2 text-slate-300 md:hidden"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-white/10 bg-[#080b16] px-6 py-5 md:hidden">
          <nav className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="text-sm font-medium text-slate-300"
              >
                {item.label}
              </a>
            ))}

            <div className="mt-2 flex flex-col gap-3 border-t border-white/10 pt-4">
              <Link
                href="/login"
                onClick={closeMenu}
                className="text-sm font-semibold text-slate-300"
              >
                Academy Login
              </Link>

              <Link
                href="/inquiry"
                onClick={closeMenu}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold"
              >
                Join the Academy
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/20">
        <Dumbbell className="h-5 w-5" />
      </div>

      <div>
        <p className="text-lg font-black tracking-tight">DojoFlow</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
          Karate Academy
        </p>
      </div>
    </Link>
  );
}

function Badge() {
  return (
    <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-red-400">
      <Flame className="h-4 w-4" />
      Discipline. Strength. Progress.
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[540px]">
      <div className="absolute inset-8 rounded-full border border-red-500/20" />
      <div className="absolute inset-16 rounded-full border border-red-500/20" />
      <div className="absolute inset-24 rounded-full border border-red-500/20" />

      <div className="relative aspect-square overflow-hidden rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-red-600/20 via-slate-900 to-slate-950 shadow-2xl shadow-red-950/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.22),transparent_48%)]" />

        <div className="absolute left-1/2 top-1/2 flex h-52 w-52 -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center rounded-[2rem] border border-red-500/40 bg-red-600/10 shadow-[0_0_100px_rgba(239,68,68,0.18)]">
          <Dumbbell
            className="h-24 w-24 -rotate-45 text-red-500"
            strokeWidth={1.2}
          />
        </div>

        <div className="absolute left-6 top-6 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Training
          </p>
          <p className="mt-1 text-sm font-bold text-white">
            Mind · Body · Spirit
          </p>
        </div>

        <div className="absolute bottom-6 right-6 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-xs font-semibold text-slate-300">
              Progress every day
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-6 -left-5 rounded-2xl border border-white/10 bg-[#111625]/95 p-5 shadow-2xl backdrop-blur-xl sm:-left-10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Trophy className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs text-slate-500">Your next milestone</p>
            <p className="mt-1 text-sm font-bold text-white">
              One class closer
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrimaryButton({
  href,
  children,
  small = false,
}: {
  href: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-3 rounded-xl bg-red-600 font-bold transition hover:bg-red-500 ${
        small ? "px-5 py-2.5 text-sm" : "px-7 py-4 text-sm shadow-xl shadow-red-600/20 hover:-translate-y-0.5"
      }`}
    >
      {children}
      <ArrowRight className="h-5 w-5" />
    </Link>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
        {eyebrow}
      </p>

      <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
        {title}
      </h2>

      {description && (
        <p className="mt-6 leading-8 text-slate-400">{description}</p>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-4 py-7 text-center sm:px-6 sm:py-9">
      <p className="text-3xl font-black text-white sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
      <Icon className="h-4 w-4 text-red-600" />
      {text}
    </span>
  );
}

function ProgramCard({
  program,
}: {
  program: (typeof programs)[number];
}) {
  const Icon = program.icon;

  return (
    <div className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-red-900/5">
      <div className="flex items-center justify-between">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition group-hover:bg-red-600 group-hover:text-white">
          <Icon className="h-7 w-7" />
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500">
          {program.level}
        </span>
      </div>

      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-red-600">
        {program.subtitle}
      </p>

      <h3 className="mt-3 text-2xl font-black">{program.title}</h3>

      <p className="mt-4 text-sm leading-7 text-slate-500">
        {program.description}
      </p>

      <Link
        href="/inquiry"
        className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-slate-900 transition group-hover:text-red-600"
      >
        Enquire about this program
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function FeatureCard({
  feature,
}: {
  feature: (typeof features)[number];
}) {
  const Icon = feature.icon;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-red-500/30 hover:bg-white/[0.05]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
        <Icon className="h-6 w-6" />
      </div>

      <h3 className="mt-6 text-lg font-bold">{feature.title}</h3>

      <p className="mt-3 text-sm leading-7 text-slate-400">
        {feature.description}
      </p>
    </div>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden bg-red-600 py-24">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-white/10" />
      <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full border-[50px] border-white/10" />

      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15">
          <Flame className="h-8 w-8" />
        </div>

        <h2 className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">
          Your journey starts with one step.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl leading-8 text-red-100">
          Tell us about your goals, preferred schedule and training
          experience. Our academy team will help you find the right program.
        </p>

        <Link
          href="/inquiry"
          className="mt-9 inline-flex items-center gap-3 rounded-xl bg-white px-7 py-4 text-sm font-bold text-red-600 transition hover:bg-red-50"
        >
          Start Your Journey
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#080b16]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 lg:px-8">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
          <Logo />

          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-white"
              >
                {item.label}
              </a>
            ))}

            <Link href="/login" className="transition hover:text-white">
              Academy Login
            </Link>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} DojoFlow Karate Academy. All rights
            reserved.
          </p>

          <p className="inline-flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-red-500" />
            Discipline creates progress.
          </p>
        </div>
      </div>
    </footer>
  );
}