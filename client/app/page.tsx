"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useState,
  type ReactNode,
} from "react";

import {
  ArrowRight,
  ArrowUpRight,
  Trophy,
  Mail,
  MapPin,
  Menu,
  Sparkles,
  Award,
  Check,
  Clock3,
  ChevronDown,
  Dumbbell,
  Phone,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
} from "react-icons/fa";

import { FaXTwitter } from "react-icons/fa6";


/* =========================================================
   DATA
   ========================================================= */

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


/* =========================================================
   UNIVERSAL CONTAINER
   ========================================================= */

const containerClass =
  "mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10";


/* =========================================================
   SCROLL REVEAL COMPONENT
   ========================================================= */

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
};

/*
 * The reveal styles (df-reveal, df-reveal-*) were never defined in the
 * CSS, so this wrapper never animated anything. It used to run one
 * IntersectionObserver and one re-render per section for no visible
 * result, which only cost speed on phones. It now just renders the
 * content; the props are kept so the sections do not need to change.
 */
function Reveal({ children, className = "" }: RevealProps) {
  return <div className={className}>{children}</div>;
}


/* =========================================================
   BRAND
   ========================================================= */

function Brand({
  footer = false,
}: {
  footer?: boolean;
}) {
  return (
    <Link
      href="/"
      className={`group inline-flex min-w-0 items-center gap-3 ${
        footer ? "" : "shrink-0"
      }`}
    >
      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden">
        <Image
          src="/logo.png"
          alt="DojoFlow Logo"
          width={44}
          height={44}
          priority={!footer}
          className="
            h-full
            w-full
            object-contain
            transition-transform
            duration-500
            ease-out
            group-hover:scale-105
            group-hover:rotate-1
          "
        />
      </div>

      <div className="min-w-0">
        <p
          className="
            text-lg
            font-extrabold
            tracking-[0.16em]
            text-[var(--foreground)]
            transition-colors
            duration-300
          "
        >
          Dojo
          <span className="text-[var(--gold)]">
            Flow
          </span>
        </p>

        <p
          className="
            -mt-0.5
            truncate
            text-[8px]
            font-bold
            uppercase
            tracking-[0.24em]
            text-[var(--gold-dark)]
          "
        >
          Martial Arts Academy
        </p>
      </div>
    </Link>
  );
}


/* =========================================================
   HOME PAGE
   ========================================================= */

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>


      <main
        className="
          min-h-screen
          overflow-hidden
          bg-[var(--background)]
          text-[var(--foreground)]
          transition-colors
          duration-500
        "
      >


        {/* =====================================================
            NAVIGATION
            ===================================================== */}

        <header
          className="
            fixed
            inset-x-0
            top-0
            z-50
            border-b
            border-[var(--line)]
            bg-[var(--header-bg)]/95
            shadow-[0_8px_30px_rgba(15,23,42,0.04)]
            backdrop-blur-xl
          "
        >
          <div
            className={`${containerClass} flex h-[76px] items-center justify-between`}
          >
            <Brand />

            {/* Desktop navigation */}
            <nav className="hidden items-center gap-8 lg:flex">
              {[
                ["Programs", "#programs"],
                ["About Us", "#about"],
                ["Our Approach", "#experience"],
                ["FAQ", "#faq"],
              ].map(([label, href], index) => (
                <a
                  key={label}
                  href={href}
                  className="
                    df-link-line
                    text-sm
                    font-semibold
                    text-[var(--ink-muted)]
                    transition-colors
                    duration-300
                    hover:text-[var(--gold-dark)]
                  "
                  style={{
                    animationDelay: `${index * 70}ms`,
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Desktop actions */}
            <div className="hidden items-center gap-5 lg:flex">
              <Link
                href="/login"
                className="
                  df-link-line
                  text-sm
                  font-bold
                  text-[var(--ink-muted)]
                  transition-colors
                  duration-300
                  hover:text-[var(--foreground)]
                "
              >
                Student Login
              </Link>

              <Link
                href="/inquiry"
                className="
                  group
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  bg-[var(--gold)]
                  px-5
                  py-3
                  text-sm
                  font-extrabold
                  text-[#172033]
                  shadow-[0_8px_20px_rgba(201,151,53,0.18)]
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:bg-[var(--gold-light)]
                  hover:shadow-[0_14px_32px_rgba(201,151,53,0.28)]
                  active:translate-y-0
                "
              >
                Start Your Journey

                <ArrowRight
                  size={16}
                  className="
                    transition-transform
                    duration-300
                    group-hover:translate-x-1
                  "
                />
              </Link>
            </div>

            {/* Mobile menu */}
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={isMenuOpen}
              onClick={() =>
                setIsMenuOpen((value) => !value)
              }
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-[var(--line)]
                bg-[var(--card)]
                text-[var(--ink-muted)]
                transition-all
                duration-300
                hover:border-[var(--gold)]
                hover:bg-[var(--hover-bg)]
                hover:text-[var(--foreground)]
                active:scale-95
                lg:hidden
              "
            >
              {isMenuOpen ? (
                <X size={20} />
              ) : (
                <Menu size={20} />
              )}
            </button>
          </div>

          {/* Mobile navigation */}
          {isMenuOpen && (
            <div
              className="
                df-mobile-menu
                border-t
                border-[var(--line)]
                bg-[var(--header-bg)]
                px-5
                py-4
                shadow-lg
                lg:hidden
              "
            >
              <nav
                className={`${containerClass} flex flex-col gap-1`}
              >
                {[
                  ["Programs", "#programs"],
                  ["About Us", "#about"],
                  ["Our Approach", "#experience"],
                  ["FAQ", "#faq"],
                ].map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    onClick={closeMenu}
                    className="
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      font-semibold
                      text-[var(--ink-muted)]
                      transition-all
                      duration-300
                      hover:bg-[var(--hover-bg)]
                      hover:pl-5
                      hover:text-[var(--foreground)]
                    "
                  >
                    {label}
                  </a>
                ))}

                <div className="my-2 h-px bg-[var(--line)]" />

                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="
                    rounded-xl
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-[var(--ink-muted)]
                    transition-all
                    duration-300
                    hover:bg-[var(--hover-bg)]
                    hover:pl-5
                    hover:text-[var(--foreground)]
                  "
                >
                  Student Login
                </Link>

                <Link
                  href="/inquiry"
                  onClick={closeMenu}
                  className="
                    mt-2
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[var(--gold)]
                    px-5
                    py-3.5
                    text-sm
                    font-extrabold
                    text-[#172033]
                    transition-all
                    duration-300
                    hover:-translate-y-0.5
                    hover:bg-[var(--gold-light)]
                  "
                >
                  Start Your Journey
                  <ArrowRight size={16} />
                </Link>
              </nav>
            </div>
          )}
        </header>


        {/* =====================================================
            HERO
            ===================================================== */}

        <section
          className="
            relative
            isolate
            overflow-hidden
            border-b
            border-[var(--line)]
            bg-[var(--hero-bg)]
          "
        >
          {/* Ambient glow */}
          <div
            className="
              df-glow-pulse
              pointer-events-none
              absolute
              -right-32
              top-16
              h-96
              w-96
              rounded-full
              bg-[var(--gold)]
              blur-[100px]
            "
          />

          <div
            className="
              df-float-slow
              pointer-events-none
              absolute
              -left-40
              bottom-0
              h-[28rem]
              w-[28rem]
              rounded-full
              bg-[#416a9d]
              opacity-[0.08]
              blur-[120px]
            "
          />

          {/* Grid texture */}
          <div
            className="
              df-grid-move
              pointer-events-none
              absolute
              inset-0
              opacity-[0.035]
              [background-image:linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)]
              [background-size:56px_56px]
            "
          />

          <div
            className={`${containerClass} relative grid min-h-[760px] items-center gap-14 pb-20 pt-32 lg:grid-cols-[1.02fr_0.98fr] lg:pb-16 lg:pt-32`}
          >

            {/* Hero copy */}
            <div className="max-w-2xl">

              <div
                className="
                  df-hero-fade
                  df-hero-fade-1
                  mb-7
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-[var(--gold)]/30
                  bg-[var(--gold)]/10
                  px-4
                  py-2
                  text-[11px]
                  font-extrabold
                  uppercase
                  tracking-[0.18em]
                  text-[var(--gold-dark)]
                "
              >
                <Sparkles
                  size={14}
                  className="animate-pulse"
                />

                Discipline. Strength. Character.
              </div>


              <h1
                className="
                  df-hero-fade
                  df-hero-fade-2
                  text-5xl
                  font-black
                  leading-[1.03]
                  tracking-[-0.045em]
                  text-[var(--hero-foreground)]
                  sm:text-6xl
                  lg:text-7xl
                "
              >
                Train with purpose.

                <span
                  className="
                    mt-2
                    block
                    text-[var(--gold)]
                    transition-all
                    duration-500
                  "
                >
                  Live with discipline.
                </span>
              </h1>


              <p
                className="
                  df-hero-fade
                  df-hero-fade-3
                  mt-7
                  max-w-xl
                  text-base
                  leading-8
                  text-[var(--hero-muted)]
                  sm:text-lg
                "
              >
                Discover a modern approach to martial arts
                training that builds confidence, physical
                strength, focus, and lifelong discipline.
              </p>


              <div
                className="
                  df-hero-fade
                  df-hero-fade-4
                  mt-9
                  flex
                  flex-col
                  gap-3
                  sm:flex-row
                "
              >
                <Link
                  href="/inquiry"
                  className="
                    group
                    inline-flex
                    items-center
                    justify-center
                    gap-3
                    rounded-xl
                    bg-[var(--gold)]
                    px-7
                    py-4
                    text-sm
                    font-extrabold
                    text-[#172033]
                    shadow-[0_12px_30px_rgba(201,151,53,0.18)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:bg-[var(--gold-light)]
                    hover:shadow-[0_18px_40px_rgba(201,151,53,0.28)]
                    active:translate-y-0
                  "
                >
                  Book a Free Trial

                  <ArrowRight
                    size={18}
                    className="
                      transition-transform
                      duration-300
                      group-hover:translate-x-1
                    "
                  />
                </Link>

                <a
                  href="#programs"
                  className="
                    group
                    inline-flex
                    items-center
                    justify-center
                    gap-3
                    rounded-xl
                    border
                    border-[var(--hero-line)]
                    bg-[var(--hero-surface)]
                    px-7
                    py-4
                    text-sm
                    font-bold
                    text-[var(--hero-foreground)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:border-[var(--gold)]
                    hover:bg-[var(--hero-surface-hover)]
                    hover:text-[var(--gold)]
                  "
                >
                  Explore Programs

                  <ArrowRight
                    size={17}
                    className="
                      opacity-0
                      -translate-x-2
                      transition-all
                      duration-300
                      group-hover:translate-x-0
                      group-hover:opacity-100
                    "
                  />
                </a>
              </div>


              {/* Stats */}
              <div
                className="
                  df-hero-fade
                  df-hero-fade-5
                  mt-12
                  grid
                  max-w-lg
                  grid-cols-3
                  gap-4
                  border-t
                  border-[var(--hero-line)]
                  pt-7
                  sm:gap-6
                "
              >
                {[
                  ["15+", "Years of experience"],
                  ["500+", "Students trained"],
                  ["4.9/5", "Student satisfaction"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="
                      group
                      transition-transform
                      duration-300
                      hover:-translate-y-1
                    "
                  >
                    <p
                      className="
                        text-2xl
                        font-extrabold
                        text-[var(--hero-foreground)]
                        transition-colors
                        duration-300
                        group-hover:text-[var(--gold)]
                      "
                    >
                      {value}
                    </p>

                    <p className="mt-1 text-xs text-[var(--hero-muted)]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>


            {/* Hero visual */}
            <div
              className="
                df-hero-fade
                df-hero-fade-4
                relative
                mx-auto
                w-full
                max-w-xl
                lg:ml-auto
              "
            >
              <div
                className="
                  df-glow-pulse
                  pointer-events-none
                  absolute
                  -right-8
                  -top-8
                  h-40
                  w-40
                  rounded-full
                  bg-[var(--gold)]
                  blur-3xl
                "
              />

              <div
                className="
                  df-float-medium
                  pointer-events-none
                  absolute
                  -bottom-12
                  -left-12
                  h-48
                  w-48
                  rounded-full
                  bg-[#416a9d]
                  opacity-[0.18]
                  blur-3xl
                "
              />


              <div
                className="
                  df-shimmer
                  relative
                  overflow-hidden
                  rounded-[2rem]
                  border
                  border-[var(--hero-line)]
                  bg-[var(--hero-surface)]
                  p-3
                  shadow-[0_30px_80px_rgba(0,0,0,0.18)]
                  transition-all
                  duration-500
                  hover:-translate-y-2
                  hover:shadow-[0_40px_100px_rgba(0,0,0,0.25)]
                "
              >
                <div
                  className="
                    relative
                    flex
                    min-h-[470px]
                    items-end
                    overflow-hidden
                    rounded-[1.5rem]
                    bg-gradient-to-br
                    from-[#30466b]
                    via-[#1a2b49]
                    to-[#090f20]
                  "
                >
                  <div
                    className="
                      df-glow-pulse
                      absolute
                      inset-0
                      bg-[radial-gradient(ellipse_at_50%_18%,rgba(215,168,75,0.26),transparent_44%)]
                    "
                  />

                  {/* Top label */}
                  <div
                    className="
                      absolute
                      left-7
                      top-7
                      flex
                      items-center
                      gap-2
                      rounded-full
                      border
                      border-white/15
                      bg-black/20
                      px-4
                      py-2
                      text-xs
                      font-semibold
                      text-white/75
                      backdrop-blur-md
                    "
                  >
                    <span className="df-float-fast h-2 w-2 rounded-full bg-[#d7a84b]" />

                    Train with intention
                  </div>


                  {/* Abstract martial artist */}
                  <div
                    className="
                      df-float-slow
                      absolute
                      bottom-0
                      left-1/2
                      h-[78%]
                      w-[72%]
                      -translate-x-1/2
                    "
                  >
                    <div
                      className="
                        absolute
                        bottom-0
                        left-1/2
                        h-[88%]
                        w-32
                        -translate-x-1/2
                        rounded-t-[5rem]
                        bg-gradient-to-b
                        from-[#d9b078]
                        via-[#a96f45]
                        to-[#513128]
                        opacity-90
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[57%]
                        left-[14%]
                        h-24
                        w-40
                        rotate-[-22deg]
                        rounded-full
                        bg-gradient-to-r
                        from-[#c38b5e]
                        to-[#70432f]
                        transition-transform
                        duration-700
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[55%]
                        right-[10%]
                        h-24
                        w-40
                        rotate-[22deg]
                        rounded-full
                        bg-gradient-to-l
                        from-[#c38b5e]
                        to-[#70432f]
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[35%]
                        left-[22%]
                        h-36
                        w-16
                        rotate-[15deg]
                        rounded-full
                        bg-[#5c392d]
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[35%]
                        right-[22%]
                        h-36
                        w-16
                        rotate-[-15deg]
                        rounded-full
                        bg-[#5c392d]
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[25%]
                        left-[5%]
                        h-5
                        w-36
                        rotate-[25deg]
                        rounded-full
                        bg-[#d7a84b]
                        shadow-[0_0_25px_rgba(215,168,75,0.3)]
                      "
                    />

                    <div
                      className="
                        absolute
                        bottom-[25%]
                        right-[5%]
                        h-5
                        w-36
                        rotate-[-25deg]
                        rounded-full
                        bg-[#d7a84b]
                        shadow-[0_0_25px_rgba(215,168,75,0.3)]
                      "
                    />
                  </div>


                  {/* Caption */}
                  <div
                    className="
                      absolute
                      bottom-5
                      left-5
                      right-5
                      flex
                      items-center
                      justify-between
                      rounded-2xl
                      border
                      border-white/10
                      bg-[#101a33]/80
                      px-5
                      py-4
                      backdrop-blur-xl
                      transition-all
                      duration-500
                      hover:bg-[#101a33]/90
                    "
                  >
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7a84b]">
                        The Dojo Method
                      </p>

                      <p className="mt-1 text-sm font-semibold text-white">
                        Mind. Body. Character.
                      </p>
                    </div>

                    <Award
                      className="
                        df-float-medium
                        text-[#d7a84b]
                      "
                      size={26}
                    />
                  </div>
                </div>
              </div>


              {/* Floating card */}
              <div
                className="
                  df-float-medium
                  absolute
                  -bottom-6
                  -left-5
                  hidden
                  rounded-2xl
                  border
                  border-[var(--line)]
                  bg-[var(--card)]
                  px-5
                  py-4
                  shadow-[0_18px_40px_rgba(15,23,42,0.12)]
                  transition-all
                  duration-300
                  hover:-translate-y-2
                  hover:shadow-[0_24px_50px_rgba(15,23,42,0.18)]
                  sm:block
                "
              >
                <div className="flex items-center gap-3">
                  <div
                    className="
                      df-icon-hover
                      flex
                      h-10
                      w-10
                      items-center
                      justify-center
                      rounded-xl
                      bg-[var(--gold-soft)]
                      text-[var(--gold-dark)]
                    "
                  >
                    <Users size={20} />
                  </div>

                  <div>
                    <p className="text-sm font-extrabold text-[var(--foreground)]">
                      Community first
                    </p>

                    <p className="text-xs text-[var(--ink-muted)]">
                      Grow together every day
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Transition */}
          <div
            className="
              pointer-events-none
              absolute
              bottom-0
              left-0
              right-0
              h-20
              bg-gradient-to-t
              from-[var(--background)]
              to-transparent
            "
          />
        </section>


        {/* =====================================================
            PROGRAMS
            ===================================================== */}

        <section
          id="programs"
          className="scroll-mt-20 py-24"
        >
          <div className={containerClass}>

            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--gold-dark)]">
                Training for every journey
              </p>

              <h2
                className="
                  mt-4
                  text-3xl
                  font-black
                  tracking-[-0.035em]
                  text-[var(--foreground)]
                  sm:text-5xl
                "
              >
                Find your path to progress
              </h2>

              <p className="mt-5 text-base leading-7 text-[var(--ink-muted)]">
                Whether you are starting from zero or preparing
                for competition, our programs are built around
                clear goals and measurable growth.
              </p>
            </Reveal>


            <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {programs.map((program, index) => {
                const Icon = program.icon;

                return (
                  <Reveal
                    key={program.title}
                    delay={index * 100}
                  >
                    <article
                      className="
                        df-card-hover
                        group
                        h-full
                        rounded-3xl
                        border
                        border-[var(--line)]
                        bg-[var(--card)]
                        p-7
                        shadow-[0_8px_25px_rgba(15,23,42,0.035)]
                        hover:border-[var(--gold)]/50
                        hover:shadow-[0_24px_55px_rgba(15,23,42,0.11)]
                      "
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className="
                            df-icon-hover
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-2xl
                            bg-[var(--gold-soft)]
                            text-[var(--gold-dark)]
                            group-hover:bg-[var(--gold)]
                            group-hover:text-[#172033]
                          "
                        >
                          <Icon size={23} />
                        </div>

                        <span
                          className="
                            rounded-full
                            bg-[var(--surface-muted)]
                            px-3
                            py-1
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-[var(--ink-muted)]
                            transition-colors
                            duration-300
                            group-hover:bg-[var(--gold-soft)]
                            group-hover:text-[var(--gold-dark)]
                          "
                        >
                          {program.age}
                        </span>
                      </div>

                      <h3
                        className="
                          mt-7
                          text-xl
                          font-extrabold
                          text-[var(--foreground)]
                        "
                      >
                        {program.title}
                      </h3>

                      <p
                        className="
                          mt-3
                          text-sm
                          leading-7
                          text-[var(--ink-muted)]
                        "
                      >
                        {program.description}
                      </p>

                      <a
                        href="#about"
                        className="
                          group/link
                          mt-6
                          inline-flex
                          items-center
                          gap-2
                          text-sm
                          font-bold
                          text-[var(--gold-dark)]
                        "
                      >
                        Learn more

                        <ArrowRight
                          size={16}
                          className="
                            transition-transform
                            duration-300
                            group-hover/link:translate-x-1
                          "
                        />
                      </a>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>


        {/* =====================================================
            ABOUT
            ===================================================== */}

        <section
          id="about"
          className="
            scroll-mt-20
            border-y
            border-[var(--line)]
            bg-[var(--section-alt)]
            py-24
          "
        >
          <div
            className={`${containerClass} grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]`}
          >

            {/* About visual */}
            <Reveal direction="left">
              <div className="relative">
                <div
                  className="
                    df-glow-pulse
                    pointer-events-none
                    absolute
                    -left-8
                    -top-8
                    h-32
                    w-32
                    rounded-full
                    bg-[var(--gold)]
                    blur-3xl
                  "
                />

                <div
                  className="
                    relative
                    overflow-hidden
                    rounded-[2rem]
                    border
                    border-[var(--dark-line)]
                    bg-[var(--dark-panel)]
                    p-8
                    shadow-[0_25px_60px_rgba(15,23,42,0.12)]
                    transition-all
                    duration-500
                    hover:-translate-y-2
                    hover:shadow-[0_35px_75px_rgba(15,23,42,0.2)]
                    sm:p-12
                  "
                >
                  <div
                    className="
                      df-glow-pulse
                      pointer-events-none
                      absolute
                      right-0
                      top-0
                      h-56
                      w-56
                      rounded-full
                      bg-[var(--gold)]
                      blur-3xl
                    "
                  />

                  <div className="relative">
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#d7a84b]">
                      More than a workout
                    </p>

                    <h3 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">
                      The dojo is where discipline becomes a way of life.
                    </h3>

                    <p className="mt-6 text-sm leading-7 text-white/60">
                      We believe martial arts is not only about
                      learning techniques. It is about developing
                      the mindset to face challenges with confidence,
                      patience, and respect.
                    </p>

                    <div className="mt-10 grid grid-cols-2 gap-6">
                      {[
                        ["01", "Build discipline"],
                        ["02", "Develop confidence"],
                        ["03", "Improve fitness"],
                        ["04", "Respect others"],
                      ].map(([number, label], index) => (
                        <div
                          key={number}
                          className="
                            group
                            border-l-2
                            border-[#d7a84b]
                            pl-4
                            transition-all
                            duration-300
                            hover:translate-x-1
                          "
                          style={{
                            transitionDelay: `${index * 40}ms`,
                          }}
                        >
                          <p
                            className="
                              text-3xl
                              font-black
                              text-white
                              transition-colors
                              duration-300
                              group-hover:text-[#d7a84b]
                            "
                          >
                            {number}
                          </p>

                          <p className="mt-1 text-xs text-white/50">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>


            {/* About copy */}
            <Reveal direction="right">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--gold-dark)]">
                  Why choose Dojo
                </p>

                <h2
                  className="
                    mt-4
                    text-3xl
                    font-black
                    tracking-[-0.035em]
                    text-[var(--foreground)]
                    sm:text-5xl
                  "
                >
                  A structured environment for meaningful growth.
                </h2>

                <p className="mt-6 max-w-xl text-base leading-8 text-[var(--ink-muted)]">
                  Our training combines traditional martial arts
                  values with modern coaching methods. Every session
                  is designed to help students improve both on and
                  off the mat.
                </p>

                <div className="mt-9 grid gap-4 sm:grid-cols-2">
                  {benefits.map((benefit, index) => (
                    <div
                      key={benefit}
                      className="
                        group
                        flex
                        items-start
                        gap-3
                        transition-transform
                        duration-300
                        hover:translate-x-1
                      "
                      style={{
                        transitionDelay: `${index * 30}ms`,
                      }}
                    >
                      <div
                        className="
                          df-icon-hover
                          mt-0.5
                          flex
                          h-5
                          w-5
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-[var(--gold)]
                          text-[#172033]
                        "
                      >
                        <Check
                          size={13}
                          strokeWidth={3}
                        />
                      </div>

                      <span className="text-sm leading-6 text-[var(--ink-muted)]">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>

                <Link
                  href="/inquiry"
                  className="
                    group
                    mt-10
                    inline-flex
                    items-center
                    gap-3
                    rounded-xl
                    bg-[var(--foreground)]
                    px-6
                    py-3.5
                    text-sm
                    font-extrabold
                    text-[var(--background)]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:shadow-[0_12px_30px_rgba(15,23,42,0.15)]
                  "
                >
                  Talk to Our Team

                  <ArrowRight
                    size={17}
                    className="
                      transition-transform
                      duration-300
                      group-hover:translate-x-1
                    "
                  />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>


        {/* =====================================================
            EXPERIENCE
            ===================================================== */}

        <section
          id="experience"
          className="scroll-mt-20 py-24"
        >
          <div className={containerClass}>

            <Reveal>
              <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--gold-dark)]">
                    Your training experience
                  </p>

                  <h2
                    className="
                      mt-4
                      text-3xl
                      font-black
                      tracking-[-0.035em]
                      text-[var(--foreground)]
                      sm:text-5xl
                    "
                  >
                    Progress that you can feel and measure.
                  </h2>
                </div>

                <p className="max-w-xl text-base leading-8 text-[var(--ink-muted)] lg:ml-auto">
                  From your first class to your next belt, every
                  part of the journey is organized to keep you
                  motivated, supported, and moving forward.
                </p>
              </div>
            </Reveal>


            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: Clock3,
                  step: "Step 01",
                  title: "Start at your level",
                  description:
                    "Begin with a welcoming assessment so your instructor can understand your goals and recommend the right program.",
                },
                {
                  icon: Target,
                  step: "Step 02",
                  title: "Train with consistency",
                  description:
                    "Follow a clear curriculum that develops technique, strength, mobility, confidence, and mental focus.",
                },
                {
                  icon: Award,
                  step: "Step 03",
                  title: "Celebrate progress",
                  description:
                    "Track your development through assessments, belt progression, feedback, and personal milestones.",
                },
              ].map((item, index) => {
                const Icon = item.icon;

                return (
                  <Reveal
                    key={item.step}
                    delay={index * 120}
                  >
                    <article
                      className="
                        df-card-hover
                        group
                        h-full
                        rounded-3xl
                        border
                        border-[var(--line)]
                        bg-[var(--card)]
                        p-8
                        shadow-[0_8px_25px_rgba(15,23,42,0.035)]
                        hover:border-[var(--gold)]/45
                        hover:shadow-[0_24px_55px_rgba(15,23,42,0.1)]
                      "
                    >
                      <div
                        className="
                          df-icon-hover
                          flex
                          h-14
                          w-14
                          items-center
                          justify-center
                          rounded-2xl
                          bg-[var(--gold-soft)]
                          text-[var(--gold-dark)]
                          group-hover:bg-[var(--gold)]
                          group-hover:text-[#172033]
                        "
                      >
                        <Icon size={26} />
                      </div>

                      <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--gold-dark)]">
                        {item.step}
                      </p>

                      <h3 className="mt-3 text-2xl font-extrabold text-[var(--foreground)]">
                        {item.title}
                      </h3>

                      <p className="mt-4 text-sm leading-7 text-[var(--ink-muted)]">
                        {item.description}
                      </p>

                      <div
                        className="
                          mt-7
                          h-px
                          w-10
                          bg-[var(--gold)]
                          transition-all
                          duration-500
                          group-hover:w-20
                        "
                      />
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>


        {/* =====================================================
            CTA
            ===================================================== */}

        <section className="pb-24">
          <div className={containerClass}>
            <Reveal direction="scale">
              <div
                className="
                  group
                  relative
                  overflow-hidden
                  rounded-[2rem]
                  bg-[var(--gold)]
                  px-7
                  py-12
                  shadow-[0_25px_60px_rgba(201,151,53,0.15)]
                  transition-all
                  duration-500
                  hover:shadow-[0_35px_80px_rgba(201,151,53,0.24)]
                  sm:px-12
                  lg:px-16
                "
              >
                <div
                  className="
                    df-glow-pulse
                    pointer-events-none
                    absolute
                    -right-20
                    -top-28
                    h-72
                    w-72
                    rounded-full
                    bg-white
                    blur-3xl
                  "
                />

                <div className="relative flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
                  <div className="max-w-2xl">
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#5f4616]">
                      Your next chapter starts here
                    </p>

                    <h2
                      className="
                        mt-4
                        text-3xl
                        font-black
                        tracking-[-0.03em]
                        text-[#172033]
                        sm:text-4xl
                      "
                    >
                      Ready to take the first step?
                    </h2>

                    <p className="mt-4 max-w-xl text-sm leading-7 text-[#5f4616]">
                      Book a trial session and experience how
                      martial arts can transform your body,
                      mindset, and confidence.
                    </p>
                  </div>

                  <Link
                    href="/inquiry"
                    className="
                      group/button
                      inline-flex
                      shrink-0
                      items-center
                      gap-3
                      rounded-xl
                      bg-[#172033]
                      px-7
                      py-4
                      text-sm
                      font-extrabold
                      text-white
                      shadow-lg
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:bg-[#22304d]
                      hover:shadow-xl
                    "
                  >
                    Book a Free Trial

                    <ArrowRight
                      size={18}
                      className="
                        transition-transform
                        duration-300
                        group-hover/button:translate-x-1
                      "
                    />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>


        {/* =====================================================
            FAQ
            ===================================================== */}

        <section
          id="faq"
          className="
            scroll-mt-20
            border-t
            border-[var(--line)]
            bg-[var(--section-alt)]
            py-24
          "
        >
          <div className={`${containerClass} max-w-7xl`}>

            <Reveal>
              <div className="text-center">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--gold-dark)]">
                  Frequently asked questions
                </p>

                <h2
                  className="
                    mt-4
                    text-3xl
                    font-black
                    tracking-[-0.035em]
                    text-[var(--foreground)]
                    sm:text-5xl
                  "
                >
                  Everything you need to know
                </h2>
              </div>
            </Reveal>


            <Reveal
              delay={120}
              direction="scale"
            >
              <div
                className="
                  mt-12
                  divide-y
                  divide-[var(--line)]
                  overflow-hidden
                  rounded-3xl
                  border
                  border-[var(--line)]
                  bg-[var(--card)]
                  px-6
                  shadow-[0_8px_25px_rgba(15,23,42,0.035)]
                  transition-shadow
                  duration-500
                  hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)]
                  sm:px-8
                "
              >
                {faqs.map((faq, index) => {
                  const isOpen = openFaq === index;

                  return (
                    <div
                      key={faq.question}
                      className="
                        py-6
                        transition-colors
                        duration-300
                        hover:bg-[var(--hover-bg)]
                      "
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaq(
                            isOpen ? null : index
                          )
                        }
                        aria-expanded={isOpen}
                        className="
                          flex
                          w-full
                          items-center
                          justify-between
                          gap-5
                          text-left
                        "
                      >
                        <span
                          className="
                            text-base
                            font-extrabold
                            text-[var(--foreground)]
                            transition-colors
                            duration-300
                            sm:text-lg
                          "
                        >
                          {faq.question}
                        </span>

                        <span
                          className="
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-full
                            bg-[var(--gold-soft)]
                            text-[var(--gold-dark)]
                            transition-all
                            duration-300
                          "
                        >
                          <ChevronDown
                            size={18}
                            className={`
                              transition-transform
                              duration-300
                              ${
                                isOpen
                                  ? "rotate-180"
                                  : ""
                              }
                            `}
                          />
                        </span>
                      </button>

                      {isOpen && (
                        <p
                          className="
                            df-faq-answer
                            max-w-3xl
                            pr-8
                            pt-4
                            text-sm
                            leading-7
                            text-[var(--ink-muted)]
                          "
                        >
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Reveal>
          </div>
        </section>


        {/* =====================================================
            FOOTER
            ===================================================== */}

        <footer
          id="contact"
          className="
            relative
            overflow-hidden
            bg-[var(--footer-bg)]
            text-white
          "
        >
          <div
            className="
              df-glow-pulse
              pointer-events-none
              absolute
              -left-32
              top-20
              h-72
              w-72
              rounded-full
              bg-[#d7a84b]
              blur-3xl
            "
          />

          <div
            className="
              df-float-slow
              pointer-events-none
              absolute
              -right-32
              bottom-0
              h-96
              w-96
              rounded-full
              bg-[#416a9d]
              opacity-[0.07]
              blur-3xl
            "
          />


          <div
            className={`${containerClass} relative py-16`}
          >

            {/* Footer CTA */}
            <Reveal direction="up">
              <div
                className="
                  group
                  mb-16
                  flex
                  flex-col
                  justify-between
                  gap-8
                  rounded-3xl
                  border
                  border-white/10
                  bg-white/[0.035]
                  p-7
                  transition-all
                  duration-500
                  hover:border-[#d7a84b]/30
                  hover:bg-white/[0.055]
                  sm:p-10
                  lg:flex-row
                  lg:items-center
                "
              >
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#d7a84b]">
                    Start Your Journey
                  </p>

                  <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                    Build strength. Develop discipline.

                    <span className="block text-white/45">
                      Become the best version of yourself.
                    </span>
                  </h2>
                </div>

                <Link
                  href="/inquiry"
                  className="
                    group/button
                    inline-flex
                    shrink-0
                    items-center
                    justify-center
                    gap-3
                    rounded-xl
                    bg-[#d7a84b]
                    px-6
                    py-3.5
                    text-sm
                    font-extrabold
                    text-[#172033]
                    transition-all
                    duration-300
                    hover:-translate-y-1
                    hover:bg-[#e5bd68]
                    hover:shadow-[0_12px_30px_rgba(215,168,75,0.25)]
                  "
                >
                  Book a Trial Class

                  <ArrowUpRight
                    size={18}
                    className="
                      transition-transform
                      duration-300
                      group-hover/button:-translate-y-1
                      group-hover/button:translate-x-1
                    "
                  />
                </Link>
              </div>
            </Reveal>


            {/* Footer columns */}
            <div className="grid gap-12 md:grid-cols-[1.4fr_0.8fr_0.8fr_1fr] lg:gap-16">

              {/* Brand */}
              <Reveal delay={50}>
                <div>
                  <Brand footer />

                  <p className="mt-6 max-w-sm text-sm leading-7 text-white/50">
                    Building stronger bodies, sharper minds,
                    and better character through the practice
                    of martial arts.
                  </p>

                  <div className="mt-6 flex items-center gap-3">
                    {[
                      {
                        label: "Instagram",
                        icon: FaInstagram,
                      },
                      {
                        label: "YouTube",
                        icon: FaYoutube,
                      },
                      {
                        label: "Facebook",
                        icon: FaFacebookF,
                      },
                      {
                        label: "X",
                        icon: FaXTwitter,
                      },
                    ].map((social) => {
                      const Icon = social.icon;

                      return (
                        <a
                          key={social.label}
                          href="#"
                          aria-label={social.label}
                          className="
                            group/social
                            flex
                            h-10
                            w-10
                            items-center
                            justify-center
                            rounded-full
                            border
                            border-white/15
                            text-white/55
                            transition-all
                            duration-300
                            hover:-translate-y-1
                            hover:border-[#d7a84b]
                            hover:bg-[#d7a84b]
                            hover:text-[#172033]
                          "
                        >
                          <Icon
                            size={
                              social.label === "Facebook"
                                ? 16
                                : 18
                            }
                            className="
                              transition-transform
                              duration-300
                              group-hover/social:scale-110
                              group-hover/social:rotate-3
                            "
                          />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </Reveal>


              {/* Quick Links */}
              <Reveal delay={120}>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Quick Links
                  </h3>

                  <div className="mt-6 flex flex-col gap-4">
                    {[
                      ["About Us", "#about"],
                      ["Our Programs", "#programs"],
                      ["Our Approach", "#experience"],
                      [
                        "Frequently Asked Questions",
                        "#faq",
                      ],
                    ].map(([label, href]) => (
                      <a
                        key={label}
                        href={href}
                        className="
                          group
                          flex
                          items-center
                          gap-2
                          text-sm
                          text-white/50
                          transition-all
                          duration-300
                          hover:translate-x-1
                          hover:text-[#d7a84b]
                        "
                      >
                        {label}

                        <ArrowUpRight
                          size={14}
                          className="
                            opacity-0
                            transition-all
                            duration-300
                            group-hover:translate-x-0.5
                            group-hover:-translate-y-0.5
                            group-hover:opacity-100
                          "
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </Reveal>


              {/* Get Started */}
              <Reveal delay={180}>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Get Started
                  </h3>

                  <div className="mt-6 flex flex-col gap-4">
                    {[
                      {
                        label: "Book a Trial",
                        href: "/inquiry",
                      },
                      {
                        label: "Student Login",
                        href: "/login",
                      },
                      {
                        label: "View Programs",
                        href: "#programs",
                      },
                      {
                        label: "Contact Academy",
                        href: "#contact",
                      },
                    ].map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        className="
                          group
                          flex
                          items-center
                          gap-2
                          text-sm
                          text-white/50
                          transition-all
                          duration-300
                          hover:translate-x-1
                          hover:text-[#d7a84b]
                        "
                      >
                        {item.label}

                        <ArrowUpRight
                          size={14}
                          className="
                            opacity-0
                            transition-all
                            duration-300
                            group-hover:translate-x-0.5
                            group-hover:-translate-y-0.5
                            group-hover:opacity-100
                          "
                        />
                      </a>
                    ))}
                  </div>
                </div>
              </Reveal>


              {/* Contact */}
              <Reveal delay={240}>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Contact Us
                  </h3>

                  <div className="mt-6 space-y-5 text-sm text-white/50">

                    <div className="flex items-start gap-3">
                      <MapPin
                        size={18}
                        className="mt-0.5 shrink-0 text-[#d7a84b]"
                      />

                      <p className="leading-6">
                        Dubai, United Arab Emirates
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Phone
                        size={17}
                        className="shrink-0 text-[#d7a84b]"
                      />

                      <a
                        href="tel:+971500000000"
                        className="transition hover:text-[#d7a84b]"
                      >
                        +971 50 000 0000
                      </a>
                    </div>

                    <div className="flex items-center gap-3">
                      <Mail
                        size={17}
                        className="shrink-0 text-[#d7a84b]"
                      />

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
              </Reveal>
            </div>


            {/* Bottom footer */}
            <Reveal delay={100}>
              <div
                className="
                  mt-16
                  flex
                  flex-col
                  justify-between
                  gap-4
                  border-t
                  border-white/10
                  pt-7
                  text-xs
                  text-white/35
                  sm:flex-row
                  sm:items-center
                "
              >
                <p>
                  © {new Date().getFullYear()} Dojo Martial Arts
                  Academy. All rights reserved.
                </p>

                <div className="flex flex-wrap items-center gap-5">
                  <a
                    href="#"
                    className="transition hover:text-[#d7a84b]"
                  >
                    Privacy Policy
                  </a>

                  <a
                    href="#"
                    className="transition hover:text-[#d7a84b]"
                  >
                    Terms of Service
                  </a>

                  <p className="hidden text-[#d7a84b]/70 sm:block">
                    Train with purpose. Live with discipline.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </footer>
      </main>
    </>
  );
}