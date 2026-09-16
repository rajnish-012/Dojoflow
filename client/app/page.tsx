"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import {
  ArrowRight,
  ArrowUpRight,
  Trophy,
  Mail,
  MapPin,
  Menu,
  Sparkles ,
  Award ,
  Check ,
  Clock3 ,
  ChevronDown,
  Dumbbell,
  Phone,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";

import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";

import { FaXTwitter } from "react-icons/fa6";

const programs = [
  {
    icon: ShieldCheck,
    title: "Kids Karate",
    description:
      "Build confidence, discipline, coordination, and respect through structured martial arts training.",
    age: "Ages 5–12",
  },
  {
    icon: Target,
    title: "Teen Karate",
    description:
      "Develop focus, self-defense awareness, physical strength, and a strong personal mindset.",
    age: "Ages 13–17",
  },
  {
    icon: Trophy,
    title: "Adult Training",
    description:
      "Improve fitness, mobility, confidence, and technique in a focused and supportive environment.",
    age: "Ages 18+",
  },
  {
    icon: Dumbbell,
    title: "Competition Training",
    description:
      "Advanced coaching for students preparing for grading, tournaments, and competitive performance.",
    age: "Advanced students",
  },
];

const benefits = [
  "Certified and experienced instructors",
  "Structured belt progression",
  "Safe and supportive training environment",
  "Flexible training schedules",
  "Personal development beyond martial arts",
  "Regular assessments and progress tracking",
];

const faqs = [
  {
    question: "Do I need previous martial arts experience?",
    answer:
      "No. Our programs are designed for complete beginners as well as experienced students. Every student starts at an appropriate level.",
  },
  {
    question: "What age can children start karate?",
    answer:
      "Children can generally begin from around five years old. The exact starting age depends on the child's readiness and the selected program.",
  },
  {
    question: "What should I wear for the first class?",
    answer:
      "Comfortable sportswear is suitable for the first session. Once enrolled, students can purchase the appropriate karate uniform.",
  },
  {
    question: "How often should I attend training?",
    answer:
      "Most students benefit from attending two to three sessions per week. Your instructor can recommend a schedule based on your goals.",
  },
];

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7f8fb] text-[#172033]">
      {/* Navigation */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-[#101a33]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/dashboard" className="flex min-w-0 items-center">
            {/* Logo */}
            <div className="relative flex shrink-0 items-center justify-center overflow-hidden">
              <Image
                src="/logo.png"
                alt="DojoFlow Logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-contain"
              />
            </div>

            {/* Brand name */}

            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-[0.18em] text-white">
                Dojo<span className="text-[#d7a84b]">Flow</span>
              </p>
              <p className="-mt-1 text-[9px] font-semibold uppercase tracking-[0.3em] text-[#d7a84b]">
                Martial Arts Academy
              </p>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-8 lg:flex">
            <a
              href="#programs"
              className="text-sm font-medium text-white/75 transition hover:text-[#d7a84b]"
            >
              Programs
            </a>
            <a
              href="#about"
              className="text-sm font-medium text-white/75 transition hover:text-[#d7a84b]"
            >
              About Us
            </a>
            <a
              href="#experience"
              className="text-sm font-medium text-white/75 transition hover:text-[#d7a84b]"
            >
              Our Approach
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-white/75 transition hover:text-[#d7a84b]"
            >
              FAQ
            </a>
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link
              href="/login"
              className="text-sm font-semibold text-white/80 transition hover:text-white"
            >
              Student Login
            </Link>

            <Link
              href="/inquiry"
              className="inline-flex items-center gap-2 rounded-full bg-[#d7a84b] px-5 py-3 text-sm font-bold text-[#101a33] transition hover:bg-[#e5bd6c]"
            >
              Start Your Journey
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="rounded-lg border border-white/15 p-2 text-white lg:hidden"
          >
            {isMenuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>

        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="mx-4 rounded-2xl border border-white/10 bg-[#101a33]/95 p-5 shadow-2xl backdrop-blur-xl lg:hidden">
            <nav className="flex flex-col gap-1">
              <a
                href="#programs"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                Programs
              </a>
              <a
                href="#about"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                About Us
              </a>
              <a
                href="#experience"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                Our Approach
              </a>
              <a
                href="#faq"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
              >
                FAQ
              </a>

              <div className="my-3 h-px bg-white/10" />

              <Link
                href="/login"
                onClick={closeMenu}
                className="rounded-lg px-3 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                Student Login
              </Link>

              <Link
                href="/inquiry"
                onClick={closeMenu}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-[#d7a84b] px-5 py-3 text-sm font-bold text-[#101a33]"
              >
                Start Your Journey
                <ArrowRight size={16} />
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative isolate min-h-[720px] bg-[#101a33]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(215,168,75,0.18),transparent_32%),radial-gradient(circle_at_10%_90%,rgba(45,85,145,0.25),transparent_35%)]" />

        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.4)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto grid min-h-[720px] max-w-7xl items-center gap-12 px-5 pb-20 pt-36 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-10 lg:pt-28">
          <div className="max-w-2xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d7a84b]/30 bg-[#d7a84b]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e7c77f]">
              <Sparkles size={14} />
              Discipline. Strength. Character.
            </div>

            <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Train with purpose.
              <span className="mt-2 block text-[#d7a84b]">
                Live with discipline.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-8 text-white/65 sm:text-lg">
              Discover a modern approach to martial arts training that builds
              confidence, physical strength, focus, and lifelong discipline.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/inquiry"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-[#d7a84b] px-7 py-4 text-sm font-extrabold text-[#101a33] transition hover:bg-[#e5bd6c]"
              >
                Book a Free Trial
                <ArrowRight size={18} />
              </Link>

              <a
                href="#programs"
                className="inline-flex items-center justify-center gap-3 rounded-full border border-white/20 px-7 py-4 text-sm font-bold text-white transition hover:border-[#d7a84b] hover:text-[#d7a84b]"
              >
                Explore Programs
              </a>
            </div>

            <div className="mt-12 grid max-w-lg grid-cols-3 gap-5 border-t border-white/10 pt-7">
              <div>
                <p className="text-2xl font-extrabold text-white">15+</p>
                <p className="mt-1 text-xs text-white/45">
                  Years of experience
                </p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">500+</p>
                <p className="mt-1 text-xs text-white/45">Students trained</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">4.9/5</p>
                <p className="mt-1 text-xs text-white/45">
                  Student satisfaction
                </p>
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -right-5 -top-5 h-32 w-32 rounded-full bg-[#d7a84b]/15 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[#2e568d]/30 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-3 shadow-2xl backdrop-blur-sm">
              <div className="relative flex min-h-[470px] items-end overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#263c61] via-[#172744] to-[#0a1124]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(215,168,75,0.25),transparent_45%)]" />

                <div className="absolute left-8 top-8 flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#d7a84b]" />
                  Train with intention
                </div>

                <div className="absolute bottom-0 left-1/2 h-[78%] w-[72%] -translate-x-1/2">
                  <div className="absolute bottom-0 left-1/2 h-[88%] w-32 -translate-x-1/2 rounded-t-[5rem] bg-gradient-to-b from-[#d9b078] via-[#a96f45] to-[#513128] opacity-90 blur-[0.2px]" />
                  <div className="absolute bottom-[57%] left-[14%] h-24 w-40 rotate-[-22deg] rounded-full bg-gradient-to-r from-[#c38b5e] to-[#70432f]" />
                  <div className="absolute bottom-[55%] right-[10%] h-24 w-40 rotate-[22deg] rounded-full bg-gradient-to-l from-[#c38b5e] to-[#70432f]" />
                  <div className="absolute bottom-[35%] left-[22%] h-36 w-16 rotate-[15deg] rounded-full bg-[#5c392d]" />
                  <div className="absolute bottom-[35%] right-[22%] h-36 w-16 rotate-[-15deg] rounded-full bg-[#5c392d]" />
                  <div className="absolute bottom-[25%] left-[5%] h-5 w-36 rotate-[25deg] rounded-full bg-[#d7a84b]" />
                  <div className="absolute bottom-[25%] right-[5%] h-5 w-36 rotate-[-25deg] rounded-full bg-[#d7a84b]" />
                </div>

                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl border border-white/10 bg-[#101a33]/75 px-5 py-4 backdrop-blur-xl">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7a84b]">
                      The Dojo Method
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      Mind. Body. Character.
                    </p>
                  </div>
                  <Award className="text-[#d7a84b]" size={26} />
                </div>
              </div>
            </div>

            <div className="absolute -bottom-6 -left-5 hidden rounded-2xl border border-white/10 bg-white px-5 py-4 shadow-xl sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8efde] text-[#a87418]">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#172033]">
                    Community first
                  </p>
                  <p className="text-xs text-[#697386]">
                    Grow together every day
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#f7f8fb] to-transparent" />
      </section>

      {/* Programs */}
      <section
        id="programs"
        className="scroll-mt-20 px-5 py-24 sm:px-8 lg:px-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a87418]">
              Training for every journey
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#172033] sm:text-5xl">
              Find your path to progress
            </h2>
            <p className="mt-5 text-base leading-7 text-[#697386]">
              Whether you are starting from zero or preparing for competition,
              our programs are built around clear goals and measurable growth.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {programs.map((program) => {
              const Icon = program.icon;

              return (
                <div
                  key={program.title}
                  className="group rounded-3xl border border-[#e4e8ef] bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#d7a84b]/50 hover:shadow-xl hover:shadow-[#172033]/5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f8efde] text-[#a87418] transition group-hover:bg-[#d7a84b] group-hover:text-[#101a33]">
                      <Icon size={24} />
                    </div>
                    <span className="rounded-full bg-[#f4f6f9] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#697386]">
                      {program.age}
                    </span>
                  </div>

                  <h3 className="mt-7 text-xl font-extrabold text-[#172033]">
                    {program.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-[#697386]">
                    {program.description}
                  </p>

                  <a
                    href="#about"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#a87418] transition group-hover:gap-3"
                  >
                    Learn more
                    <ArrowRight size={16} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About section */}
      <section
        id="about"
        className="scroll-mt-20 bg-[#101a33] px-5 py-24 sm:px-8 lg:px-10"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative">
            <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-[#d7a84b]/10 blur-3xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#263c61] to-[#0a1124] p-8 sm:p-12">
              <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[#d7a84b]/10 blur-3xl" />

              <div className="relative">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#d7a84b]">
                  More than a workout
                </p>

                <h3 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">
                  The dojo is where discipline becomes a way of life.
                </h3>

                <p className="mt-6 text-sm leading-7 text-white/60">
                  We believe martial arts is not only about learning techniques.
                  It is about developing the mindset to face challenges with
                  confidence, patience, and respect.
                </p>

                <div className="mt-10 grid grid-cols-2 gap-6">
                  <div className="border-l-2 border-[#d7a84b] pl-4">
                    <p className="text-3xl font-black text-white">01</p>
                    <p className="mt-1 text-xs text-white/50">
                      Build discipline
                    </p>
                  </div>

                  <div className="border-l-2 border-[#d7a84b] pl-4">
                    <p className="text-3xl font-black text-white">02</p>
                    <p className="mt-1 text-xs text-white/50">
                      Develop confidence
                    </p>
                  </div>

                  <div className="border-l-2 border-[#d7a84b] pl-4">
                    <p className="text-3xl font-black text-white">03</p>
                    <p className="mt-1 text-xs text-white/50">
                      Improve fitness
                    </p>
                  </div>

                  <div className="border-l-2 border-[#d7a84b] pl-4">
                    <p className="text-3xl font-black text-white">04</p>
                    <p className="mt-1 text-xs text-white/50">Respect others</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#d7a84b]">
              Why choose Dojo
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-white sm:text-5xl">
              A structured environment for meaningful growth.
            </h2>

            <p className="mt-6 max-w-xl text-base leading-8 text-white/60">
              Our training combines traditional martial arts values with modern
              coaching methods. Every session is designed to help students
              improve both on and off the mat.
            </p>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d7a84b] text-[#101a33]">
                    <Check size={13} strokeWidth={3} />
                  </div>
                  <span className="text-sm leading-6 text-white/75">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/inquiry"
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#d7a84b] px-6 py-3.5 text-sm font-extrabold text-[#101a33] transition hover:bg-[#e5bd6c]"
            >
              Talk to Our Team
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      {/* Experience / approach */}
      <section
        id="experience"
        className="scroll-mt-20 px-5 py-24 sm:px-8 lg:px-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a87418]">
                Your training experience
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#172033] sm:text-5xl">
                Progress that you can feel and measure.
              </h2>
            </div>

            <p className="max-w-xl text-base leading-8 text-[#697386] lg:ml-auto">
              From your first class to your next belt, every part of the journey
              is organized to keep you motivated, supported, and moving forward.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <div className="rounded-3xl border border-[#e4e8ef] bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8efde] text-[#a87418]">
                <Clock3 size={26} />
              </div>
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[#a87418]">
                Step 01
              </p>
              <h3 className="mt-3 text-2xl font-extrabold text-[#172033]">
                Start at your level
              </h3>
              <p className="mt-4 text-sm leading-7 text-[#697386]">
                Begin with a welcoming assessment so your instructor can
                understand your goals and recommend the right program.
              </p>
            </div>

            <div className="rounded-3xl border border-[#e4e8ef] bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8efde] text-[#a87418]">
                <Target size={26} />
              </div>
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[#a87418]">
                Step 02
              </p>
              <h3 className="mt-3 text-2xl font-extrabold text-[#172033]">
                Train with consistency
              </h3>
              <p className="mt-4 text-sm leading-7 text-[#697386]">
                Follow a clear curriculum that develops technique, strength,
                mobility, confidence, and mental focus.
              </p>
            </div>

            <div className="rounded-3xl border border-[#e4e8ef] bg-white p-8 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f8efde] text-[#a87418]">
                <Award size={26} />
              </div>
              <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[#a87418]">
                Step 03
              </p>
              <h3 className="mt-3 text-2xl font-extrabold text-[#172033]">
                Celebrate progress
              </h3>
              <p className="mt-4 text-sm leading-7 text-[#697386]">
                Track your development through assessments, belt progression,
                feedback, and personal milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-24 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#d7a84b] px-7 py-12 sm:px-12 lg:px-16">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#5f4616]">
                Your next chapter starts here
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#101a33] sm:text-4xl">
                Ready to take the first step?
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#5f4616]">
                Book a trial session and experience how martial arts can
                transform your body, mindset, and confidence.
              </p>
            </div>

            <Link
              href="/inquiry"
              className="inline-flex shrink-0 items-center gap-3 rounded-full bg-[#101a33] px-7 py-4 text-sm font-extrabold text-white transition hover:bg-[#1c2d52]"
            >
              Book a Free Trial
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-20 bg-white px-5 py-24 sm:px-8 lg:px-10"
      >
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#a87418]">
              Frequently asked questions
            </p>

            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#172033] sm:text-5xl">
              Everything you need to know
            </h2>
          </div>

          <div className="mt-12 divide-y divide-[#e4e8ef] rounded-3xl border border-[#e4e8ef] bg-[#f7f8fb] px-6 sm:px-8">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div key={faq.question} className="py-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-5 text-left"
                  >
                    <span className="text-base font-extrabold text-[#172033] sm:text-lg">
                      {faq.question}
                    </span>

                    <ChevronDown
                      size={20}
                      className={`shrink-0 text-[#a87418] transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <p className="max-w-3xl pr-8 pt-4 text-sm leading-7 text-[#697386]">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-[#081126] text-white">
        {/* Decorative background elements */}
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#d7a84b]/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-500/[0.06] blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          {/* Top CTA section */}
          <div className="mb-16 flex flex-col justify-between gap-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7 sm:p-10 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#d7a84b]">
                Start Your Journey
              </p>

              <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                Build strength. Develop discipline.
                <span className="block text-white/50">
                  Become the best version of yourself.
                </span>
              </h2>
            </div>

            <Link
              href="/inquiry"
              className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-full bg-[#d7a84b] px-6 py-3.5 text-sm font-extrabold text-[#101a33] transition hover:bg-[#e5bd68]"
            >
              Book a Trial Class
              <ArrowUpRight
                size={18}
                className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </div>

          {/* Main footer content */}
          <div className="grid gap-12 md:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] lg:gap-16">
            {/* Brand section */}
            <div>
              <Link href="/" className="inline-flex items-center gap-3">
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
                  <Image
                    src="/logo.png"
                    alt="DojoFlow Logo"
                    width={48}
                    height={48}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div>
                  <p className="text-xl font-extrabold tracking-[0.16em]">
                    Dojo<span className="text-[#d7a84b]">Flow</span>
                  </p>

                  <p className="-mt-0.5 text-[9px] font-bold uppercase tracking-[0.28em] text-[#d7a84b]">
                    Martial Arts Academy
                  </p>
                </div>
              </Link>

              <p className="mt-6 max-w-sm text-sm leading-7 text-white/50">
                Building stronger bodies, sharper minds, and better character
                through the practice of martial arts.
              </p>

              <div className="mt-6 flex items-center gap-3">
                {/* Instagram */}
                <a
                  href="#"
                  aria-label="Instagram"
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition duration-300 hover:border-[#d7a84b] hover:bg-[#d7a84b] hover:text-[#101a33]"
                >
                  <FaInstagram
                    size={18}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />
                </a>

                {/* YouTube */}
                <a
                  href="#"
                  aria-label="YouTube"
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition duration-300 hover:border-[#d7a84b] hover:bg-[#d7a84b] hover:text-[#101a33]"
                >
                  <FaYoutube
                    size={18}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />
                </a>

                {/* Facebook */}
                <a
                  href="#"
                  aria-label="Facebook"
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition duration-300 hover:border-[#d7a84b] hover:bg-[#d7a84b] hover:text-[#101a33]"
                >
                  <FaFacebookF
                    size={16}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />
                </a>

                {/* X / Twitter */}
                <a
                  href="#"
                  aria-label="X"
                  className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/55 transition duration-300 hover:border-[#d7a84b] hover:bg-[#d7a84b] hover:text-[#101a33]"
                >
                  <FaXTwitter
                    size={17}
                    className="transition-transform duration-300 group-hover:scale-110"
                  />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-extrabold text-white">Quick Links</h3>

              <div className="mt-6 flex flex-col gap-4">
                <a
                  href="#about"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  About Us
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>

                <a
                  href="#programs"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Our Programs
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>

                <a
                  href="#experience"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Our Approach
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>

                <a
                  href="#faq"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Frequently Asked Questions
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>
              </div>
            </div>

            {/* Get Started */}
            <div>
              <h3 className="text-sm font-extrabold text-white">Get Started</h3>

              <div className="mt-6 flex flex-col gap-4">
                <Link
                  href="/inquiry"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Book a Trial
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </Link>

                <Link
                  href="/login"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Student Login
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </Link>

                <a
                  href="#programs"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  View Programs
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>

                <a
                  href="#contact"
                  className="group flex items-center gap-2 text-sm text-white/50 transition hover:text-[#d7a84b]"
                >
                  Contact Academy
                  <ArrowUpRight
                    size={14}
                    className="opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </a>
              </div>
            </div>

            {/* Contact section */}
            <div>
              <h3 className="text-sm font-extrabold text-white">Contact Us</h3>

              <div className="mt-6 space-y-5 text-sm text-white/50">
                <div className="flex items-start gap-3">
                  <MapPin
                    size={18}
                    className="mt-0.5 shrink-0 text-[#d7a84b]"
                  />

                  <p className="leading-6">Dubai, United Arab Emirates</p>
                </div>

                <div className="flex items-center gap-3">
                  <Phone size={17} className="shrink-0 text-[#d7a84b]" />

                  <a
                    href="tel:+971500000000"
                    className="transition hover:text-[#d7a84b]"
                  >
                    +971 50 000 0000
                  </a>
                </div>

                <div className="flex items-center gap-3">
                  <Mail size={17} className="shrink-0 text-[#d7a84b]" />

                  <a
                    href="mailto:hello@dojoacademy.com"
                    className="break-all transition hover:text-[#d7a84b]"
                  >
                    hello@dojoacademy.com
                  </a>
                </div>

                <p className="border-l border-[#d7a84b]/40 pl-3 leading-6">
                  Mon–Sat
                  <br />
                  6:00 AM–10:00 PM
                </p>
              </div>
            </div>
          </div>

          {/* Bottom footer bar */}
          <div className="mt-16 flex flex-col justify-between gap-4 border-t border-white/10 pt-7 text-xs text-white/35 sm:flex-row sm:items-center">
            <p>
              © {new Date().getFullYear()} Dojo Martial Arts Academy. All rights
              reserved.
            </p>

            <div className="flex items-center gap-5">
              <a href="#" className="transition hover:text-[#d7a84b]">
                Privacy Policy
              </a>

              <a href="#" className="transition hover:text-[#d7a84b]">
                Terms of Service
              </a>

              <p className="hidden text-[#d7a84b]/70 sm:block">
                Train with purpose. Live with discipline.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
