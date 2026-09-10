import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Student Management",
    description:
      "Manage student admissions, profiles, plans, branches, login accounts and active status from one place.",
  },
  {
    icon: ClipboardList,
    title: "Training Plans",
    description:
      "Create structured training plans and organize students according to their learning journey.",
  },
  {
    icon: Target,
    title: "Curriculum Management",
    description:
      "Define techniques, skills and training requirements for each stage of the karate curriculum.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance Tracking",
    description:
      "Record and monitor daily student attendance with a simple and efficient workflow.",
  },
  {
    icon: BarChart3,
    title: "Performance Tracking",
    description:
      "Track student performance, scores, remarks and improvement over time.",
  },
  {
    icon: Trophy,
    title: "Progress & Belt Journey",
    description:
      "Keep track of student progress, achievements and belt progression throughout training.",
  },
];

const programs = [
  {
    number: "01",
    title: "Beginner Training",
    description:
      "Build a strong foundation with basic karate techniques, discipline and fitness.",
  },
  {
    number: "02",
    title: "Intermediate Training",
    description:
      "Develop technique, combinations, physical conditioning and controlled practice.",
  },
  {
    number: "03",
    title: "Advanced Training",
    description:
      "Focus on advanced techniques, performance, precision and continuous improvement.",
  },
];

const journey = [
  {
    step: "01",
    title: "Admission",
    description: "Register and create the student's profile.",
  },
  {
    step: "02",
    title: "Training Plan",
    description: "Assign the appropriate training plan.",
  },
  {
    step: "03",
    title: "Curriculum",
    description: "Follow structured techniques and skills.",
  },
  {
    step: "04",
    title: "Attendance",
    description: "Track regular training participation.",
  },
  {
    step: "05",
    title: "Performance",
    description: "Evaluate skills and training performance.",
  },
  {
    step: "06",
    title: "Progress",
    description: "Monitor development and belt milestones.",
  },
];

const benefits = [
  "Centralized student information",
  "Structured karate curriculum",
  "Daily attendance management",
  "Performance evaluation",
  "Student progress tracking",
  "Role-based access control",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 shadow-lg shadow-red-600/20">
              <Dumbbell className="h-5 w-5" />
            </div>

            <div>
              <p className="text-lg font-black tracking-tight">DojoFlow</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-slate-400">
                Karate Academy
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a
              href="#about"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              About
            </a>
            <a
              href="#programs"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Programs
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Features
            </a>
            <a
              href="#journey"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Journey
            </a>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold transition hover:bg-red-500"
          >
            Login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(220,38,38,0.18),transparent_35%)]" />

        <div className="absolute right-[-180px] top-24 h-[500px] w-[500px] rounded-full border border-red-500/10" />
        <div className="absolute right-[-100px] top-44 h-[340px] w-[340px] rounded-full border border-red-500/10" />

        <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300">
              <Sparkles className="h-4 w-4" />
              Train. Track. Progress.
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Master the art of
              <span className="block text-red-500">Karate.</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
              DojoFlow brings student management, training plans, curriculum,
              attendance, performance and progress tracking together in one
              powerful academy management platform.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="group flex items-center justify-center gap-2 rounded-xl bg-red-600 px-7 py-3.5 font-semibold shadow-xl shadow-red-900/20 transition hover:bg-red-500"
              >
                Access Academy
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>

              <a
                href="#features"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Explore Features
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Student Portal
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Role-Based Access
              </div>

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                Progress Tracking
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative flex items-center justify-center">
            <div className="relative flex h-[430px] w-[430px] items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-red-500/20" />
              <div className="absolute inset-8 rounded-full border border-red-500/10" />
              <div className="absolute inset-20 rounded-full bg-red-600/10 blur-3xl" />

              <div className="relative flex h-64 w-64 items-center justify-center rounded-full border border-red-500/30 bg-slate-900 shadow-2xl shadow-red-900/20">
                <div className="flex h-40 w-40 items-center justify-center rounded-full bg-red-600 shadow-2xl shadow-red-600/30">
                  <Dumbbell className="h-20 w-20" strokeWidth={1.5} />
                </div>
              </div>

              <div className="absolute left-0 top-20 rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
                <Award className="mb-2 h-6 w-6 text-red-400" />
                <p className="text-sm font-bold">Belt Progress</p>
                <p className="text-xs text-slate-500">Track milestones</p>
              </div>

              <div className="absolute bottom-12 right-0 rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
                <BarChart3 className="mb-2 h-6 w-6 text-red-400" />
                <p className="text-sm font-bold">Performance</p>
                <p className="text-xs text-slate-500">Measure growth</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-slate-900/60">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 px-6 py-10 sm:grid-cols-4 lg:px-8">
          <div className="px-5 text-center">
            <p className="text-3xl font-black text-white">01</p>
            <p className="mt-1 text-sm text-slate-500">Unified Platform</p>
          </div>

          <div className="px-5 text-center">
            <p className="text-3xl font-black text-white">06+</p>
            <p className="mt-1 text-sm text-slate-500">Core Modules</p>
          </div>

          <div className="mt-8 border-white/10 px-5 text-center sm:mt-0">
            <p className="text-3xl font-black text-white">24/7</p>
            <p className="mt-1 text-sm text-slate-500">Accessible System</p>
          </div>

          <div className="mt-8 border-white/10 px-5 text-center sm:mt-0">
            <p className="text-3xl font-black text-white">100%</p>
            <p className="mt-1 text-sm text-slate-500">Organized Workflow</p>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 bg-white py-24 text-slate-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
                About DojoFlow
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Everything your dojo needs to stay organized.
              </h2>

              <p className="mt-6 text-lg leading-8 text-slate-600">
                A karate academy is about more than training. Students need
                structured plans, consistent attendance, performance
                evaluation and visible progress.
              </p>

              <p className="mt-4 leading-7 text-slate-600">
                DojoFlow provides a centralized system for academy
                administrators and coaches while giving students their own
                portal to view their training journey.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <CheckCircle2 className="h-6 w-6 text-red-600" />
                  <p className="mt-3 font-semibold">{benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section id="programs" className="scroll-mt-20 bg-slate-100 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
              Training Programs
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              A structured path for every student.
            </h2>

            <p className="mt-5 leading-7 text-slate-600">
              Training can be organized into progressive stages so students
              always know what they are working toward.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {programs.map((program) => (
              <div
                key={program.number}
                className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <p className="text-sm font-black text-red-600">
                  {program.number}
                </p>

                <h3 className="mt-6 text-2xl font-black text-slate-900">
                  {program.title}
                </h3>

                <p className="mt-4 leading-7 text-slate-600">
                  {program.description}
                </p>

                <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-red-600">
                  Structured Training
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-500">
              Academy Management
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Powerful tools for the complete training lifecycle.
            </h2>

            <p className="mt-5 leading-7 text-slate-400">
              From admission to belt progression, DojoFlow keeps every
              important part of the academy workflow connected.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition hover:border-red-500/30 hover:bg-white/[0.05]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
                    <Icon className="h-6 w-6" />
                  </div>

                  <h3 className="mt-6 text-xl font-bold">{feature.title}</h3>

                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Journey */}
      <section id="journey" className="scroll-mt-20 bg-white py-24 text-slate-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-600">
              Student Journey
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              From first class to continuous progress.
            </h2>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {journey.map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-slate-200 p-6"
              >
                <span className="text-sm font-black text-red-600">
                  STEP {item.step}
                </span>

                <h3 className="mt-4 text-xl font-black">{item.title}</h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose */}
      <section className="bg-red-600 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-red-100">
                Why DojoFlow
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                Focus on training.
                <br />
                Let DojoFlow handle the organization.
              </h2>

              <p className="mt-6 max-w-xl leading-8 text-red-100">
                A clean and centralized workflow helps administrators and
                coaches spend less time managing information and more time
                helping students improve.
              </p>

              <Link
                href="/login"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-red-600 transition hover:bg-red-50"
              >
                Enter DojoFlow
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <Shield className="h-8 w-8" />
                <h3 className="mt-5 text-lg font-bold">Role-Based Access</h3>
                <p className="mt-2 text-sm leading-6 text-red-100">
                  Different academy roles receive access to the tools they
                  need.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <Dumbbell className="h-8 w-8" />
                <h3 className="mt-5 text-lg font-bold">Training Focused</h3>
                <p className="mt-2 text-sm leading-6 text-red-100">
                  Built around the actual student training and progression
                  workflow.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <BarChart3 className="h-8 w-8" />
                <h3 className="mt-5 text-lg font-bold">Progress Visibility</h3>
                <p className="mt-2 text-sm leading-6 text-red-100">
                  Make student development easier to understand and track.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                <Trophy className="h-8 w-8" />
                <h3 className="mt-5 text-lg font-bold">Achievement Driven</h3>
                <p className="mt-2 text-sm leading-6 text-red-100">
                  Keep milestones and belt progression visible throughout the
                  journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-950 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600">
            <Award className="h-8 w-8" />
          </div>

          <h2 className="mt-7 text-4xl font-black tracking-tight sm:text-5xl">
            Ready to step into the dojo?
          </h2>

          <p className="mx-auto mt-5 max-w-2xl leading-7 text-slate-400">
            Access your DojoFlow account and continue your academy journey.
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-red-600 px-7 py-3.5 font-bold transition hover:bg-red-500"
          >
            Login to DojoFlow
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600">
              <Dumbbell className="h-4 w-4" />
            </div>

            <div>
              <p className="font-bold">DojoFlow</p>
              <p className="text-xs text-slate-500">
                Karate Academy Management
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} DojoFlow. All rights reserved.
          </p>

          <Link
            href="/login"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            Academy Login →
          </Link>
        </div>
      </footer>
    </main>
  );
}