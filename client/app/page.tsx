"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import "./landing.css";

import type { HeroBrand } from "@/app/components/landing/Hero3D";
import InternationalPhoneInput from "@/components/ui/InternationalPhoneInput";
import { AcademyLogo } from "@/components/settings/AcademyBrandProvider";

/* =========================================================
   API
========================================================= */

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

/* =========================================================
   BRAND HELPERS
========================================================= */

const emptyBrand: HeroBrand = {
  academyName: "",
  tagline: "",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "",
  secondaryColor: "",
  contactEmail: "",
  contactPhone: "",
  website: "",
  address: "",
  timezone: "",
  currency: "",
};

function normalizeBrand(
  value: Partial<HeroBrand> | null | undefined,
): HeroBrand {
  return {
    academyName: value?.academyName?.trim() || "",
    tagline: value?.tagline?.trim() || "",
    logoUrl: value?.logoUrl?.trim() || "",
    faviconUrl: value?.faviconUrl?.trim() || "",
    primaryColor: value?.primaryColor?.trim() || "",
    secondaryColor: value?.secondaryColor?.trim() || "",
    contactEmail: value?.contactEmail?.trim() || "",
    contactPhone: value?.contactPhone?.trim() || "",
    website: value?.website?.trim() || "",
    address: value?.address?.trim() || "",
    timezone: value?.timezone?.trim() || "",
    currency: value?.currency?.trim() || "",
  };
}

function displayAcademyName(brand: HeroBrand) {
  return brand.academyName || "Your Academy";
}

function displayTagline(brand: HeroBrand) {
  return brand.tagline || "Train with purpose. Live with discipline.";
}

function displayAddress(brand: HeroBrand) {
  return brand.address || "Visit our academy for training details.";
}

/* =========================================================
   DATA
========================================================= */

const martialArts = [
  { href: "#programs", label: "Karate" },
  { href: "#programs", label: "Sports Karate" },
  { href: "#programs", label: "Boxing" },
  { href: "#programs", label: "Kickboxing" },
  { href: "#programs", label: "Taekwondo" },
  { href: "#programs", label: "Mixed Martial Art (MMA)" },
  { href: "#programs", label: "Martial Arts Combat Session" },
  { href: "#programs", label: "Fitness Session" },
  { href: "#programs", label: "Self Defence Session" },
];

const artCraft = [
  { href: "#activities", label: "Craft Programme" },
  { href: "#activities", label: "Colouring And Painting" },
  { href: "#activities", label: "Drawing" },
];

const heroSlides = [
  {
    cls: "lp-hero-slide-1",
    label: "Elite Martial Arts Training",
    h1: ["Unlock Your Potential", "Train with Experts"],
    p: "Build strength, discipline, and confidence with certified instructors in a welcoming environment for all ages.",
    primaryBtn: { label: "Book a Free Trial", href: "/inquiry" },
    secondaryBtn: { label: "Explore Programs", href: "#programs" },
  },
  {
    cls: "lp-hero-slide-2",
    label: "Karate Combat Dubai",
    h1: ["Train Hard,", "Fight Smart"],
    p: "Experience world-class boxing and karate coaching that pushes you to your peak — every single session.",
    primaryBtn: { label: "View Time Slots", href: "#schedule" },
    secondaryBtn: { label: "Our Activities", href: "#activities" },
  },
  {
    cls: "lp-hero-slide-3",
    label: "Train Like a Champion",
    h1: ["MMA & Combat", "Training"],
    p: "From beginner to champion — our structured programs build real-world fighting skills and mental toughness.",
    primaryBtn: { label: "Start Your Journey", href: "/inquiry" },
    secondaryBtn: { label: "Contact Us", href: "#contact" },
  },
];

const activities = [
  {
    img: "/activity-karate.jpg",
    emoji: "🥋",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    title: "Sports Karate",
    href: "#programs",
  },
  {
    img: "/boxing-girl.png",
    emoji: "🥊",
    gradient: "linear-gradient(135deg, #1e0a0a 0%, #3d1515 100%)",
    title: "Boxing",
    href: "#programs",
  },
  {
    img: "/fighting-girl.png",
    emoji: "🦵",
    gradient: "linear-gradient(135deg, #0a1a0a 0%, #153d15 100%)",
    title: "Kickboxing",
    href: "#programs",
  },
  {
    img: "/activity-mma.jpg",
    emoji: "🤼",
    gradient: "linear-gradient(135deg, #1a0a1e 0%, #3d153d 100%)",
    title: "MMA",
    href: "#programs",
  },
  {
    img: null,
    emoji: "🏆",
    gradient: "linear-gradient(135deg, #1a100a 0%, #3d2515 100%)",
    title: "Thai Boxing",
    href: "#programs",
  },
  {
    img: null,
    emoji: "👊",
    gradient: "linear-gradient(135deg, #0a0a1a 0%, #15153d 100%)",
    title: "Self Defence",
    href: "#programs",
  },
  {
    img: null,
    emoji: "🦶",
    gradient: "linear-gradient(135deg, #1a1a0a 0%, #3d3d15 100%)",
    title: "Taekwondo",
    href: "#programs",
  },
  {
    img: null,
    emoji: "💪",
    gradient: "linear-gradient(135deg, #0a1a1a 0%, #153d3d 100%)",
    title: "Fitness Session",
    href: "#programs",
  },
];

const portfolioItems = [
  {
    bg: "linear-gradient(135deg, #1a0a0a 0%, #3d1515 50%, #1a0a0a 100%)",
    emoji: "🥋",
    cat: "Martial Arts",
    title: "The Best Martial Art Category",
  },
  {
    bg: "linear-gradient(135deg, #0a1a0a 0%, #153d15 50%, #0a1a0a 100%)",
    emoji: "🥊",
    cat: "Boxing",
    title: "The Best Thai Boxing Category",
  },
  {
    bg: "linear-gradient(135deg, #0a0a1a 0%, #15153d 50%, #0a0a1a 100%)",
    emoji: "🦵",
    cat: "Taekwondo",
    title: "The Best Taekwondo Category",
  },
  {
    bg: "linear-gradient(135deg, #1a1a0a 0%, #3d3d15 50%, #1a1a0a 100%)",
    emoji: "🤼",
    cat: "MMA",
    title: "Mixed Martial Arts Combat",
  },
  {
    bg: "linear-gradient(135deg, #1a0a1a 0%, #3d153d 50%, #1a0a1a 100%)",
    emoji: "🛡️",
    cat: "Self Defence",
    title: "Self Defense Mastery",
  },
  {
    bg: "linear-gradient(135deg, #0a1a1a 0%, #153d3d 50%, #0a1a1a 100%)",
    emoji: "💪",
    cat: "Fitness",
    title: "Total Fitness Transformation",
  },
];

const testimonials = [
  {
    initials: "AS",
    name: "Ahmed S.",
    role: "Karate Student",
    rating: 5,
    text: "Joining DojoFlow completely changed my life. The instructors are incredible — patient, professional, and genuinely care about your progress. I went from zero martial arts experience to winning my first tournament in 8 months.",
  },
  {
    initials: "PR",
    name: "Priya R.",
    role: "Parent of 2 Students",
    rating: 5,
    text: "My children absolutely love the kids program here. Their confidence has skyrocketed, they're more disciplined at school, and most importantly they look forward to every class. The safest place I've found for martial arts training.",
  },
  {
    initials: "MK",
    name: "Mohammed K.",
    role: "MMA Competitor",
    rating: 5,
    text: "The training quality here is exceptional. The coaches have real competitive experience and teach modern techniques. The facility is top-notch and the community is incredibly supportive. Best academy by far.",
  },
];

const faqs = [
  {
    q: "Are martial arts sports?",
    a: "Yes, martial arts are considered sports. Martial arts like karate, taekwondo, judo, and boxing involve physical activity, rules, competition, and skill — all key elements of a sport. Some are also included in international sporting events like the Olympics.",
  },
  {
    q: "What types of martial arts do you teach?",
    a: "We offer Karate, Sports Karate, Boxing, Kickboxing, Muay Thai, Taekwondo, MMA, Martial Arts Combat Sessions, Fitness Sessions, and Self-Defense techniques for men and women.",
  },
  {
    q: "Do you provide fitness training as well?",
    a: "Yes! Our Fitness Sessions include strength training, body toning, cardio workouts, and martial-arts-inspired fitness for overall transformation — suitable for both beginners and advanced learners.",
  },
  {
    q: "What is the duration of your courses?",
    a: "Duration varies: Martial arts & fitness use an ongoing batch system (monthly enrollment). Self defense workshops are short-term 1–2 week programs also available.",
  },
  {
    q: "Do you offer trial classes?",
    a: "Yes, we provide trial classes for most of our programs so you can experience the training environment before enrolling fully.",
  },
  {
    q: "Are certificates provided after completion?",
    a: "Absolutely! We offer professional and recognized certificates after successful completion of our Martial Arts training programs.",
  },
  {
    q: "What facilities are available at your training center?",
    a: "Our academy is fully equipped with training mats and gear, punching bags and safety equipment, CCTV surveillance, hygiene, drinking water, and first-aid support.",
  },
  {
    q: "Do I need previous experience to join?",
    a: "No. Our programs are designed for complete beginners as well as experienced students. Every student starts at an appropriate level with personalized guidance.",
  },
  {
    q: "How can I enroll in the programs?",
    a: "You can call us, visit our academy directly, or fill out the online inquiry form on our website. Our team will contact you with details, available batches, and fee structure.",
  },
];

const blogPosts = [
  {
    img: null,
    emoji: "🥋",
    gradient: "linear-gradient(135deg, #1a0a2e 0%, #3d1560 100%)",
    cat: "Taekwondo",
    title: "Taekwondo Near Me: 7 Benefits for Kids and Beginners",
    excerpt: "Discover why Taekwondo is one of the most beneficial martial arts for children and beginners. From discipline to physical fitness, we cover 7 compelling reasons to start today.",
    href: "#blog",
    featured: true,
  },
  {
    img: null,
    emoji: "🥊",
    gradient: "linear-gradient(135deg, #1e0a0a 0%, #4d1515 100%)",
    cat: "Karate",
    title: "Karate Training Near Me: 7 Benefits for Kids Beyond Physical Fitness",
    excerpt: "Parents often think karate is just about kicks and punches. Learn about the hidden benefits that make karate transformative for children's development.",
    href: "#blog",
    featured: false,
  },
  {
    img: null,
    emoji: "👊",
    gradient: "linear-gradient(135deg, #0a1a0e 0%, #154030 100%)",
    cat: "Kickboxing",
    title: "Kickboxing Classes in Dubai: 7 Ways to Build Strength, Speed and Confidence",
    excerpt: "Kickboxing is more than a workout — it's a full-body transformation. Discover how kickboxing builds strength, speed, and confidence.",
    href: "#blog",
    featured: false,
  },
  {
    img: null,
    emoji: "🎨",
    gradient: "linear-gradient(135deg, #1a1000 0%, #403010 100%)",
    cat: "Art & Craft",
    title: "Art & Craft: 7 Creative Activities Kids Can Enjoy Beyond the Classroom",
    excerpt: "Creative activities build problem-solving, patience, and self-expression. Explore 7 art and craft activities your kids will love.",
    href: "#blog",
    featured: false,
  },
];

const galleryImages = [
  { emoji: "🥋", bg: "linear-gradient(135deg, #1a0a0a 0%, #4d1515 100%)" },
  { emoji: "🥊", bg: "linear-gradient(135deg, #0a1a0a 0%, #154d15 100%)" },
  { emoji: "🤼", bg: "linear-gradient(135deg, #0a0a1a 0%, #15154d 100%)" },
  { emoji: "🦵", bg: "linear-gradient(135deg, #1a1a0a 0%, #4d4d15 100%)" },
  { emoji: "🛡️", bg: "linear-gradient(135deg, #1a0a1a 0%, #4d154d 100%)" },
  { emoji: "💪", bg: "linear-gradient(135deg, #0a1a1a 0%, #154d4d 100%)" },
  { emoji: "🏆", bg: "linear-gradient(135deg, #1a0a0a 0%, #4d1515 100%)" },
  { emoji: "🎯", bg: "linear-gradient(135deg, #0a1a0a 0%, #154d15 100%)" },
  { emoji: "⚡", bg: "linear-gradient(135deg, #0a0a1a 0%, #15154d 100%)" },
];

const features = [
  { emoji: "🎯", label: "Free Trial" },
  { emoji: "🚌", label: "Transportation" },
  { emoji: "📹", label: "CCTV Surveillance" },
  { emoji: "🏆", label: "Tournament Exposure" },
  { emoji: "💳", label: "Card Payment" },
];

/* =========================================================
   COUNTER HOOK
========================================================= */

function useCounter(
  target: number,
  inView: boolean,
  duration = 2000,
) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return value;
}

/* =========================================================
   STAT COUNTER COMPONENT
========================================================= */

function StatCounter({
  target,
  suffix,
  label,
}: {
  target: number;
  suffix: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const value = useCounter(target, inView);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="lp-stat-item">
      <div className="lp-stat-num">
        {value}
        <span className="suffix">{suffix}</span>
      </div>
      <div className="lp-stat-label">{label}</div>
    </div>
  );
}

/* =========================================================
   SCROLL REVEAL HOOK
========================================================= */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" },
    );

    const elements = document.querySelectorAll(
      ".lp-reveal, .lp-reveal-left, .lp-reveal-right",
    );
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* =========================================================
   HOME PAGE
========================================================= */

export default function HomePage() {
  const [brand, setBrand] = useState<HeroBrand>(emptyBrand);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDropdown, setMobileDropdown] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [leadPhone, setLeadPhone] = useState("");
  const [activeNav, setActiveNav] = useState("home");
  const slideTimer = useRef<NodeJS.Timeout | null>(null);

  useReveal();

  /* Load brand */
  useEffect(() => {
    let active = true;
    async function loadBrand() {
      try {
        const res = await fetch(`${API_URL}/settings/academy/public`, {
          method: "GET",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        const settings = data?.settings ?? data?.data ?? null;
        if (active && settings) setBrand(normalizeBrand(settings));
      } catch {
        // silent
      }
    }
    loadBrand();
    return () => { active = false; };
  }, []);

  /* Auto-play slider */
  useEffect(() => {
    slideTimer.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => { if (slideTimer.current) clearInterval(slideTimer.current); };
  }, []);

  function goToSlide(i: number) {
    setActiveSlide(i);
    if (slideTimer.current) clearInterval(slideTimer.current);
    slideTimer.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
  }

  const academyName = displayAcademyName(brand);
  const tagline = displayTagline(brand);
  const address = displayAddress(brand);

  return (
    <div className="lp-root">
      {/* ===================================================
          TOP INFO BAR
      =================================================== */}
      <div className="lp-topbar">
        <div className="lp-container lp-topbar-inner">
          <div className="lp-topbar-left">
            <span className="lp-topbar-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 10.81 19.79 19.79 0 012 2.18 2 2 0 014 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.8 12.8 0 002.81.7A2 2 0 0122 14z"/></svg>
              <a href={`tel:${brand.contactPhone || "+971561009899"}`}>
                {brand.contactPhone || "+971 56 100 9899"}
              </a>
            </span>
            <span className="lp-topbar-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Mon – Sat</span>
            </span>
            <span className="lp-topbar-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <a href={`mailto:${brand.contactEmail || "training@academy.com"}`}>
                {brand.contactEmail || "training@academy.com"}
              </a>
            </span>
          </div>
          <div className="lp-topbar-right">
            <a
              className="lp-social-icon"
              href="https://www.facebook.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
            >f</a>
            <a
              className="lp-social-icon"
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >ig</a>
            <a
              className="lp-social-icon"
              href="https://www.tiktok.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
            >tt</a>
          </div>
        </div>
      </div>

      {/* ===================================================
          NAVBAR
      =================================================== */}
      <div className="lp-nav-wrapper">
        <div className="lp-container lp-nav-inner">
          {/* Logo */}
          <Link href="/" className="lp-nav-logo">
            <AcademyLogo className="lp-nav-brand-logo" />
            <div className="lp-nav-logo-text">
              <span className="lp-nav-logo-name">{academyName}</span>
              <span className="lp-nav-logo-tagline">{tagline}</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <ul className="lp-nav-links">
            <li className="lp-nav-item">
              <a
                href="#"
                className={`lp-nav-link${activeNav === "home" ? " active" : ""}`}
                onClick={() => setActiveNav("home")}
              >Home</a>
            </li>
            <li className="lp-nav-item">
              <a
                href="#about"
                className={`lp-nav-link${activeNav === "about" ? " active" : ""}`}
                onClick={() => setActiveNav("about")}
              >About Us</a>
            </li>
            <li className="lp-nav-item lp-nav-item-dropdown">
              <button
                className={`lp-nav-link${activeNav === "martial" ? " active" : ""}`}
                onClick={() => setActiveNav("martial")}
              >
                Martial Art
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="lp-dropdown">
                {martialArts.map((item) => (
                  <a key={item.label} href={item.href} className="lp-dropdown-link"
                    onClick={() => setActiveNav("martial")}>
                    {item.label}
                  </a>
                ))}
              </div>
            </li>
            <li className="lp-nav-item lp-nav-item-dropdown">
              <button
                className={`lp-nav-link${activeNav === "craft" ? " active" : ""}`}
                onClick={() => setActiveNav("craft")}
              >
                Art & Craft
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div className="lp-dropdown">
                {artCraft.map((item) => (
                  <a key={item.label} href={item.href} className="lp-dropdown-link"
                    onClick={() => setActiveNav("craft")}>
                    {item.label}
                  </a>
                ))}
              </div>
            </li>
            <li className="lp-nav-item">
              <a
                href="#blog"
                className={`lp-nav-link${activeNav === "blog" ? " active" : ""}`}
                onClick={() => setActiveNav("blog")}
              >Blog</a>
            </li>
            <li className="lp-nav-item">
              <a
                href="#gallery"
                className={`lp-nav-link${activeNav === "gallery" ? " active" : ""}`}
                onClick={() => setActiveNav("gallery")}
              >Gallery</a>
            </li>
            <li className="lp-nav-item">
              <a
                href="#contact"
                className={`lp-nav-link${activeNav === "contact" ? " active" : ""}`}
                onClick={() => setActiveNav("contact")}
              >Contact Us</a>
            </li>
          </ul>

          {/* Desktop actions */}
          <div className="lp-nav-actions">
            <Link href="/login" className="lp-btn-login">
              Student Login
            </Link>
            <Link href="/inquiry" className="lp-btn-cta">
              Book Free Trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className="lp-hamburger"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile nav */}
        <div className={`lp-mobile-nav ${mobileOpen ? "open" : ""}`}>
          <a href="#" className="lp-mobile-nav-link">Home</a>
          <a href="#about" className="lp-mobile-nav-link" onClick={() => setMobileOpen(false)}>About Us</a>

          <div
            className="lp-mobile-nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => setMobileDropdown(mobileDropdown === "martial" ? null : "martial")}
          >
            Martial Art ▾
          </div>
          {mobileDropdown === "martial" && (
            <div className="lp-mobile-nav-sub">
              {martialArts.map((item) => (
                <a key={item.label} href={item.href} className="lp-mobile-sub-link" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              ))}
            </div>
          )}

          <div
            className="lp-mobile-nav-link"
            style={{ cursor: "pointer" }}
            onClick={() => setMobileDropdown(mobileDropdown === "craft" ? null : "craft")}
          >
            Art & Craft ▾
          </div>
          {mobileDropdown === "craft" && (
            <div className="lp-mobile-nav-sub">
              {artCraft.map((item) => (
                <a key={item.label} href={item.href} className="lp-mobile-sub-link" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              ))}
            </div>
          )}

          <a href="#blog" className="lp-mobile-nav-link" onClick={() => setMobileOpen(false)}>Blog</a>
          <a href="#gallery" className="lp-mobile-nav-link" onClick={() => setMobileOpen(false)}>Gallery</a>
          <a href="#contact" className="lp-mobile-nav-link" onClick={() => setMobileOpen(false)}>Contact Us</a>

          <div className="lp-mobile-actions">
            <Link href="/login" className="lp-btn-login" onClick={() => setMobileOpen(false)}>
              Student Login
            </Link>
            <Link href="/inquiry" className="lp-btn-cta" onClick={() => setMobileOpen(false)}>
              Book Free Trial →
            </Link>
          </div>
        </div>
      </div>

      {/* ===================================================
          HERO SLIDER
      =================================================== */}
      <section className="lp-hero" id="home">
        <div className="lp-hero-slides">
          {heroSlides.map((slide, i) => (
            <div
              key={i}
              className={`lp-hero-slide ${slide.cls} ${i === activeSlide ? "active" : ""}`}
            />
          ))}

          <div className="lp-hero-content">
            <div className="lp-container">
              <div className="lp-hero-text lp-reveal">
                <div className="lp-hero-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  {heroSlides[activeSlide].label}
                </div>
                <h1 className="lp-hero-h1">
                  {heroSlides[activeSlide].h1[0]}
                  <span>{heroSlides[activeSlide].h1[1]}</span>
                </h1>
                <p className="lp-hero-p">{heroSlides[activeSlide].p}</p>
                <div className="lp-hero-btns">
                  <Link href={heroSlides[activeSlide].primaryBtn.href} className="lp-hero-btn-primary">
                    {heroSlides[activeSlide].primaryBtn.label}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </Link>
                  <a href={heroSlides[activeSlide].secondaryBtn.href} className="lp-hero-btn-secondary">
                    {heroSlides[activeSlide].secondaryBtn.label}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Arrows */}
          <button
            className="lp-hero-arrow lp-hero-arrow-left"
            aria-label="Previous"
            onClick={() => goToSlide((activeSlide - 1 + heroSlides.length) % heroSlides.length)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button
            className="lp-hero-arrow lp-hero-arrow-right"
            aria-label="Next"
            onClick={() => goToSlide((activeSlide + 1) % heroSlides.length)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          {/* Dots */}
          <div className="lp-hero-dots">
            {heroSlides.map((_, i) => (
              <button
                key={i}
                className={`lp-dot ${i === activeSlide ? "active" : ""}`}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goToSlide(i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          ABOUT
      =================================================== */}
      <section className="lp-about" id="about">
        <div className="lp-container">
          <div className="lp-about-grid">
            {/* Images */}
            <div className="lp-reveal-left" style={{ position: "relative" }}>
              <img
                src="/about-main.jpg"
                alt="Martial Arts Training"
                className="lp-about-img-main"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
              <div
                className="lp-about-img-main"
                style={{
                  background: "linear-gradient(135deg, #1a0a0a 0%, #4d1540 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "5rem",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: -1,
                }}
              >🥋</div>
              <div className="lp-about-badge">
                <div className="lp-about-badge-num">10+</div>
                <div className="lp-about-badge-text">Years Experience</div>
              </div>
            </div>

            {/* Content */}
            <div className="lp-reveal-right">
              <span className="lp-section-label">About Us</span>
              <h2 className="lp-section-h2">
                Welcome to <span>{academyName}</span> Martial Arts
              </h2>
              <p className="lp-section-sub">
                At {academyName}, we believe martial arts is more than just a sport — it's a way of life.
                Whether you're completely new, simply curious, or an adult looking for discipline and balance,
                our training programs are built to bring out your best. We offer expert instruction in Karate,
                Taekwondo, Boxing, Kickboxing, MMA, and more.
              </p>
              <div className="lp-about-features">
                {[
                  { title: "Who We Are", desc: "Your start to strength, confidence, and lifelong fitness." },
                  { title: "What Makes Us Special?", desc: "Separate classes for beginners, intermediates, and professionals." },
                  { title: "Inclusive & Empowering", desc: "Regular participation in inclusive tournaments and events." },
                  { title: "Special Focus on Kids", desc: "Training that is playful, engaging, and age-appropriate." },
                ].map((f) => (
                  <div key={f.title} className="lp-about-feature">
                    <div className="lp-about-feature-top">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E44498" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      <span className="lp-about-feature-title">{f.title}</span>
                    </div>
                    <span className="lp-about-feature-desc">{f.desc}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <a href="#about" className="lp-btn-pink">
                  More About Us
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
                <Link href="/inquiry" className="lp-btn-blue">
                  Book Trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          STATS
      =================================================== */}
      <section className="lp-stats">
        <div className="lp-container">
          <div className="lp-stats-grid">
            <StatCounter target={10} suffix="+" label="Years Of Experience" />
            <StatCounter target={10} suffix="+" label="Certified Trainers" />
            <StatCounter target={500} suffix="+" label="Students Trained" />
            <StatCounter target={20} suffix="+" label="Workout Programs" />
          </div>
        </div>
      </section>

      {/* ===================================================
          FEATURES DARK STRIP
      =================================================== */}
      <section className="lp-features-dark">
        <div className="lp-container">
          <div className="lp-features-header lp-reveal">
            <span className="lp-section-label">Our Features</span>
            <h2 className="lp-section-h2" style={{ color: "white" }}>
              Explore Our <span>Features</span>
            </h2>
          </div>
          <div className="lp-features-strip">
            {features.map((f) => (
              <div key={f.label} className="lp-feature-item lp-reveal">
                <div className="lp-feature-icon-wrap">{f.emoji}</div>
                <span className="lp-feature-label">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          ACTIVITIES
      =================================================== */}
      <section className="lp-activities" id="programs">
        <div className="lp-container">
          <div className="lp-activities-header lp-reveal">
            <span className="lp-section-label">Our Activities</span>
            <h2 className="lp-section-h2">
              Explore Our Exciting <span>Activities</span>
            </h2>
          </div>
          <div className="lp-activities-grid">
            {activities.map((act) => (
              <a key={act.title} href={act.href} className="lp-activity-card lp-reveal">
                {act.img ? (
                  <img
                    src={act.img}
                    alt={act.title}
                    className="lp-activity-img"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = "none";
                      const sib = img.nextSibling as HTMLElement;
                      if (sib) sib.style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="lp-activity-img-placeholder"
                  style={{
                    background: act.gradient,
                    display: act.img ? "none" : "flex",
                  }}
                >
                  {act.emoji}
                </div>
                <div className="lp-activity-label">
                  <h3 className="lp-activity-title">{act.title}</h3>
                  <span className="lp-activity-arrow">→</span>
                </div>
              </a>
            ))}
          </div>
          <div className="lp-activities-more">
            <a href="#programs" className="lp-btn-blue">
              View More Activities →
            </a>
          </div>
        </div>
      </section>

      {/* ===================================================
          PORTFOLIO / GALLERY SHOWCASE
      =================================================== */}
      <section className="lp-portfolio" id="portfolio">
        <div className="lp-container">
          <div className="lp-portfolio-header lp-reveal">
            <span className="lp-section-label">Portfolio</span>
            <h2 className="lp-section-h2">
              Will Help You <span>Completely</span>
            </h2>
          </div>
          <div className="lp-portfolio-grid">
            {portfolioItems.map((item) => (
              <div key={item.title} className="lp-portfolio-card lp-reveal">
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: item.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "3.5rem",
                  }}
                >{item.emoji}</div>
                <div className="lp-portfolio-info">
                  <p className="lp-portfolio-cat">{item.cat}</p>
                  <h3 className="lp-portfolio-title">{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          TESTIMONIALS
      =================================================== */}
      <section className="lp-testimonials">
        <div className="lp-container">
          <div className="lp-testimonials-header lp-reveal">
            <span className="lp-section-label">Testimonials</span>
            <h2 className="lp-section-h2">
              See Reviews From <span>Our Clients</span>
            </h2>
          </div>
          <div className="lp-testimonials-grid">
            {testimonials.map((t) => (
              <div key={t.name} className="lp-testimonial-card lp-reveal">
                <div className="lp-testimonial-quote">"</div>
                <p className="lp-testimonial-text">{t.text}</p>
                <div className="lp-testimonial-stars">
                  {"★".repeat(t.rating)}
                </div>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">{t.initials}</div>
                  <div>
                    <div className="lp-testimonial-name">{t.name}</div>
                    <div className="lp-testimonial-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          FAQ
      =================================================== */}
      <section className="lp-faq" id="faq">
        <div className="lp-container">
          <div className="lp-faq-header lp-reveal">
            <span className="lp-section-label">FAQ</span>
            <h2 className="lp-section-h2">
              Frequently Asked <span>Questions</span>
            </h2>
          </div>
          <div className="lp-faq-grid">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`lp-faq-item ${openFaq === i ? "open" : ""}`}
              >
                <button
                  className="lp-faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span className="lp-faq-chevron">
                    {openFaq === i ? "▲" : "▼"}
                  </span>
                </button>
                <div className="lp-faq-answer">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          BLOG
      =================================================== */}
      <section className="lp-blog" id="blog">
        <div className="lp-container">
          <div className="lp-blog-header lp-reveal">
            <span className="lp-section-label">Our Blog</span>
            <h2 className="lp-section-h2">
              Latest News And <span>Articles</span>
            </h2>
          </div>
          <div className="lp-blog-layout">
            {/* Featured */}
            {blogPosts.filter((b) => b.featured).map((post) => (
              <a key={post.title} href={post.href} className="lp-blog-featured lp-reveal-left">
                <div
                  className="lp-blog-feat-img-placeholder"
                  style={{ background: post.gradient }}
                >
                  {post.emoji}
                </div>
                <div className="lp-blog-feat-content">
                  <span className="lp-blog-cat">{post.cat}</span>
                  <h3 className="lp-blog-feat-title">{post.title}</h3>
                  <p className="lp-blog-feat-excerpt">{post.excerpt}</p>
                </div>
              </a>
            ))}

            {/* Mini posts */}
            <div className="lp-blog-list lp-reveal-right">
              {blogPosts.filter((b) => !b.featured).map((post) => (
                <a key={post.title} href={post.href} className="lp-blog-mini">
                  <div
                    className="lp-blog-mini-img-placeholder"
                    style={{ background: post.gradient }}
                  >
                    {post.emoji}
                  </div>
                  <div className="lp-blog-mini-content">
                    <span className="lp-blog-cat">{post.cat}</span>
                    <h4 className="lp-blog-mini-title">{post.title}</h4>
                    <p className="lp-blog-mini-excerpt">{post.excerpt}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          CTA BANNER
      =================================================== */}
      <section className="lp-cta">
        <div className="lp-container lp-cta-inner lp-reveal">
          <h2>
            Ready to Start Your <span>Journey?</span>
          </h2>
          <p>
            Join hundreds of students training at {academyName}.
            Book your free trial class today — no experience needed.
          </p>
          <div className="lp-cta-btns">
            <Link href="/inquiry" className="lp-hero-btn-primary">
              Book a Free Trial
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <a href="#contact" className="lp-hero-btn-secondary">
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* ===================================================
          CONTACT
      =================================================== */}
      <section className="lp-contact" id="contact">
        <div className="lp-container">
          <div className="lp-contact-grid">
            <div className="lp-reveal-left">
              <span className="lp-section-label">Contact Us</span>
              <h2 className="lp-section-h2" style={{ marginBottom: "2rem" }}>
                Get In Touch <span>With Us</span>
              </h2>
              <div className="lp-contact-cards">
                <div className="lp-contact-card">
                  <div className="lp-contact-icon">📍</div>
                  <div>
                    <div className="lp-contact-info-title">Our Location</div>
                    <div className="lp-contact-info-text">{address}</div>
                  </div>
                </div>
                <div className="lp-contact-card">
                  <div className="lp-contact-icon">📞</div>
                  <div>
                    <div className="lp-contact-info-title">Call Us</div>
                    <a href={`tel:${brand.contactPhone || "+971561009899"}`} className="lp-contact-info-text">
                      {brand.contactPhone || "+971 56 100 9899"}
                    </a>
                  </div>
                </div>
                <div className="lp-contact-card">
                  <div className="lp-contact-icon">✉️</div>
                  <div>
                    <div className="lp-contact-info-title">Email Us</div>
                    <a href={`mailto:${brand.contactEmail || "training@academy.com"}`} className="lp-contact-info-text">
                      {brand.contactEmail || "training@academy.com"}
                    </a>
                  </div>
                </div>
                <div className="lp-contact-card">
                  <div className="lp-contact-icon">⏰</div>
                  <div>
                    <div className="lp-contact-info-title">Opening Hours</div>
                    <div className="lp-contact-info-text">Mon – Saturday: 5:00 AM – 11:00 PM</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-contact-form-wrap lp-reveal-right">
              <h3>Send Us a Message</h3>
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label>Name</label>
                    <input type="text" placeholder="Your name" required />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="landing-phone">Phone</label>
                    <InternationalPhoneInput id="landing-phone" value={leadPhone} onChange={setLeadPhone} />
                  </div>
                </div>
                <div className="lp-form-group">
                  <label>Email</label>
                  <input type="email" placeholder="Your email" required />
                </div>
                <div className="lp-form-group">
                  <label>Activity Interest</label>
                  <select>
                    <option value="">Choose Activity</option>
                    {martialArts.map((m) => (
                      <option key={m.label}>{m.label}</option>
                    ))}
                    {artCraft.map((a) => (
                      <option key={a.label}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div className="lp-form-group">
                  <label>Message</label>
                  <textarea placeholder="Tell us about yourself or your child..." rows={3} />
                </div>
                <button type="submit" className="lp-form-submit">
                  Send Message →
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================
          GALLERY
      =================================================== */}
      <section className="lp-gallery" id="gallery">
        <div className="lp-container">
          <div className="lp-gallery-header lp-reveal">
            <span className="lp-section-label">Gallery</span>
            <h2 className="lp-section-h2" style={{ color: "white" }}>
              Our Training <span>Moments</span>
            </h2>
          </div>
          <div className="lp-gallery-grid">
            {galleryImages.map((img, i) => (
              <div key={i} className="lp-gallery-item lp-reveal">
                <div
                  className="lp-gallery-placeholder"
                  style={{ background: img.bg }}
                >
                  {img.emoji}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================
          FOOTER
      =================================================== */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Brand col */}
            <div className="lp-footer-brand">
              <div className="lp-nav-logo" style={{ marginBottom: "1rem" }}>
                <AcademyLogo className="lp-nav-brand-logo" />
                <div className="lp-nav-logo-text">
                  <span className="lp-nav-logo-name">{academyName}</span>
                  <span className="lp-nav-logo-tagline">{tagline}</span>
                </div>
              </div>
              <p className="lp-footer-desc">
                {tagline} — Empowering students of all ages through martial arts, fitness, and art programs.
              </p>
              <div className="lp-footer-socials">
                <a className="lp-footer-social" href="https://www.facebook.com/" target="_blank" rel="noreferrer" aria-label="Facebook">f</a>
                <a className="lp-footer-social" href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">ig</a>
                <a className="lp-footer-social" href="https://www.tiktok.com/" target="_blank" rel="noreferrer" aria-label="TikTok">tt</a>
              </div>
            </div>

            {/* Martial Art col */}
            <div className="lp-footer-col">
              <h3>Martial Art</h3>
              <ul className="lp-footer-links">
                {martialArts.slice(0, 7).map((m) => (
                  <li key={m.label}>
                    <a href={m.href}>{m.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div className="lp-footer-col">
              <h3>Quick Links</h3>
              <ul className="lp-footer-links">
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About Us</a></li>
                <li><a href="#programs">Our Activities</a></li>
                <li><a href="#blog">Blog</a></li>
                <li><a href="#gallery">Gallery</a></li>
                <li><a href="#contact">Contact Us</a></li>
                <li><Link href="/login">Student Login</Link></li>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms & Conditions</a></li>
              </ul>
            </div>

            {/* Contact */}
            <div className="lp-footer-col">
              <h3>Contact With Us</h3>
              <div className="lp-footer-contact-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <span>{address}</span>
              </div>
              <div className="lp-footer-contact-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.09 10.81 19.79 19.79 0 012 2.18 2 2 0 014 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.8 12.8 0 002.81.7A2 2 0 0122 14z"/></svg>
                <a href={`tel:${brand.contactPhone || "+971561009899"}`}>
                  {brand.contactPhone || "+971 56 100 9899"}
                </a>
              </div>
              <div className="lp-footer-contact-item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <a href={`mailto:${brand.contactEmail || "training@academy.com"}`}>
                  {brand.contactEmail || "training@academy.com"}
                </a>
              </div>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p className="lp-footer-copy">
              © {new Date().getFullYear()} <span>{academyName}</span>. All Rights Reserved.
            </p>
            <div className="lp-footer-bottom-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <Link href="/login">Student Portal</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ===================================================
          WHATSAPP FLOAT
      =================================================== */}
      <a
        className="lp-whatsapp-float"
        href={`https://wa.me/${(brand.contactPhone || "971561009899").replace(/\D/g, "")}?text=Hello!%20I%20am%20interested%20in%20joining.%20Please%20share%20details%20about%20your%20classes%20and%20free%20trial.`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
          <path d="M16.04 3C8.85 3 3 8.79 3 15.92c0 2.53.74 5 2.14 7.13L3 29l6.16-2.05a13.1 13.1 0 006.88 1.95H16c7.19 0 13.04-5.79 13.04-12.92S23.23 3 16.04 3zm7.57 18.17c-.32.89-1.86 1.69-2.56 1.8-.66.1-1.49.15-2.41-.14-.56-.18-1.27-.42-2.19-.81-3.85-1.66-6.36-5.53-6.55-5.79-.18-.26-1.56-2.06-1.56-3.93 0-1.87.98-2.79 1.33-3.17.35-.38.77-.48 1.03-.48.26 0 .52 0 .75.01.24.01.57-.09.89.68.32.77 1.08 2.67 1.17 2.87.09.2.15.43.03.69-.12.26-.18.42-.35.64-.18.22-.37.49-.53.66-.18.18-.36.37-.15.72.21.35.94 1.54 2.02 2.49 1.39 1.23 2.57 1.61 2.93 1.79.35.18.56.15.77-.09.21-.23.88-1.03 1.11-1.38.24-.35.47-.29.8-.18.33.11 2.09.98 2.45 1.16.35.18.59.26.68.4.09.14.09.81-.23 1.7z"/>
        </svg>
      </a>
    </div>
  );
}
