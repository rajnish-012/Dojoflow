"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

import {
  Award,
  MapPin,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

export type HeroBrand = {
  academyName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string;
  contactPhone: string;
  website: string;
  address: string;
  timezone: string;
  currency: string;
};

type Hero3DProps = {
  brand: HeroBrand;
};

type PointerPosition = {
  x: number;
  y: number;
};

function isValidColor(value?: string) {
  if (!value) {
    return false;
  }

  return (
    /^#[0-9a-fA-F]{3}$/.test(value) ||
    /^#[0-9a-fA-F]{6}$/.test(value)
  );
}

function getPrimaryColor(
  value?: string,
) {
  return isValidColor(value)
    ? value
    : "#BD4835";
}

function getSecondaryColor(
  value?: string,
) {
  return isValidColor(value)
    ? value
    : "#242629";
}

function getDisplayName(
  name: string,
) {
  return (
    name.trim() ||
    "Academy"
  );
}

function getDisplayTagline(
  tagline: string,
) {
  return (
    tagline.trim() ||
    "Train with purpose. Live with discipline."
  );
}

function safeImage(
  value?: string,
) {
  return value?.trim() || "";
}

export default function Hero3D({
  brand,
}: Hero3DProps) {
  const [
    pointer,
    setPointer,
  ] = useState<PointerPosition>({
    x: 0,
    y: 0,
  });

  const [
    reducedMotion,
    setReducedMotion,
  ] = useState(false);
  const [failedLogoUrl, setFailedLogoUrl] = useState("");

  useEffect(() => {
    const mediaQuery =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      );

    const updateMotion = () => {
      setReducedMotion(
        mediaQuery.matches,
      );
    };

    updateMotion();

    mediaQuery.addEventListener(
      "change",
      updateMotion,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateMotion,
      );
    };
  }, []);

  const primaryColor = useMemo(
    () =>
      getPrimaryColor(
        brand.primaryColor,
      ),
    [brand.primaryColor],
  );

  const secondaryColor = useMemo(
    () =>
      getSecondaryColor(
        brand.secondaryColor,
      ),
    [brand.secondaryColor],
  );

  const academyName = getDisplayName(
    brand.academyName,
  );

  const tagline = getDisplayTagline(
    brand.tagline,
  );

  const logoUrl = safeImage(
    brand.logoUrl,
  );
  const academyInitials = academyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("") || "A";

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (
      reducedMotion ||
      window.innerWidth < 768
    ) {
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const relativeX =
      (event.clientX - rect.left) /
        rect.width -
      0.5;

    const relativeY =
      (event.clientY - rect.top) /
        rect.height -
      0.5;

    setPointer({
      x: relativeX * 2,
      y: relativeY * 2,
    });
  }

  function resetPointer() {
    setPointer({
      x: 0,
      y: 0,
    });
  }

  const sceneStyle: CSSProperties = {
    "--brand-primary":
      primaryColor,
    "--brand-secondary":
      secondaryColor,
    transform: reducedMotion
      ? "rotateX(0deg) rotateY(0deg)"
      : `rotateX(${pointer.y * -4}deg) rotateY(${pointer.x * 5}deg)`,
  } as CSSProperties;

  return (
    <div
      className="
        relative
        mx-auto
        w-full
        max-w-[680px]
        select-none
      "
      onPointerMove={
        handlePointerMove
      }
      onPointerLeave={
        resetPointer
      }
    >
      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-1/2
          h-[300px]
          w-[300px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          blur-[90px]
          opacity-30
        "
        style={{
          background:
            primaryColor,
        }}
      />

      <div
        className="
          pointer-events-none
          absolute
          left-1/2
          top-1/2
          h-[220px]
          w-[220px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          blur-[75px]
          opacity-25
        "
        style={{
          background:
            secondaryColor,
        }}
      />

      <div
        className="
          relative
          h-[460px]
          w-full
          overflow-visible
          sm:h-[540px]
          lg:h-[600px]
        "
        style={{
          perspective:
            "1400px",
        }}
      >
        <div
          className="
            absolute
            inset-0
            transition-transform
            duration-700
            ease-out
          "
          style={{
            ...sceneStyle,
            transformStyle:
              "preserve-3d",
          }}
        >
          {/* =================================================
              BACKGROUND PARTICLES
          ================================================= */}

          <div
            className="
              pointer-events-none
              absolute
              inset-0
            "
            style={{
              transform:
                "translateZ(-100px)",
            }}
          >
            {[
              [8, 17, 2],
              [17, 70, 3],
              [28, 27, 2],
              [37, 82, 2],
              [48, 12, 3],
              [58, 68, 2],
              [69, 24, 2],
              [78, 80, 3],
              [89, 35, 2],
              [93, 67, 2],
              [12, 48, 1],
              [84, 12, 1],
            ].map(
              (
                [
                  left,
                  top,
                  size,
                ],
                index,
              ) => (
                <span
                  key={index}
                  className="
                    absolute
                    rounded-full
                    opacity-70
                    animate-[heroParticle_4s_ease-in-out_infinite]
                  "
                  style={{
                    left: `${left}%`,
                    top: `${top}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background:
                      primaryColor,
                    animationDelay: `${index * -0.45}s`,
                    boxShadow: `0 0 12px ${primaryColor}`,
                  }}
                />
              ),
            )}
          </div>

          {/* =================================================
              LARGE ORBIT SYSTEM
          ================================================= */}

          <div
            className="
              absolute
              left-1/2
              top-1/2
              h-[390px]
              w-[390px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border
              opacity-50
              animate-[heroOrbit_22s_linear_infinite]
              sm:h-[470px]
              sm:w-[470px]
              lg:h-[520px]
              lg:w-[520px]
            "
            style={{
              borderColor:
                `${primaryColor}55`,
              transformStyle:
                "preserve-3d",
              transform:
                "translate(-50%, -50%) rotateX(68deg)",
            }}
          >
            <span
              className="
                absolute
                left-1/2
                top-0
                h-3
                w-3
                -translate-x-1/2
                -translate-y-1/2
                rounded-full
              "
              style={{
                background:
                  primaryColor,
                boxShadow: `0 0 25px ${primaryColor}`,
              }}
            />
          </div>

          <div
            className="
              absolute
              left-1/2
              top-1/2
              h-[300px]
              w-[300px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border
              opacity-35
              animate-[heroOrbitReverse_17s_linear_infinite]
              sm:h-[380px]
              sm:w-[380px]
            "
            style={{
              borderColor:
                `${primaryColor}70`,
              transformStyle:
                "preserve-3d",
              transform:
                "translate(-50%, -50%) rotateX(70deg) rotateY(25deg)",
            }}
          />

          <div
            className="
              absolute
              left-1/2
              top-1/2
              h-[250px]
              w-[250px]
              -translate-x-1/2
              -translate-y-1/2
              rounded-full
              border
              border-white/10
              opacity-40
              animate-[heroOrbit_28s_linear_infinite]
              sm:h-[320px]
              sm:w-[320px]
            "
            style={{
              transformStyle:
                "preserve-3d",
              transform:
                "translate(-50%, -50%) rotateX(75deg) rotateY(-30deg)",
            }}
          />

          {/* =================================================
              FLOATING TROPHY
          ================================================= */}

          <div
            className="
              absolute
              right-[7%]
              top-[7%]
              flex
              h-16
              w-16
              items-center
              justify-center
              rounded-2xl
              border
              border-white/10
              bg-black/30
              shadow-2xl
              backdrop-blur-xl
              animate-[heroFloat_5s_ease-in-out_infinite]
              sm:h-20
              sm:w-20
            "
            style={{
              transform:
                "translateZ(110px)",
            }}
          >
            <Trophy
              size={30}
              strokeWidth={1.7}
              style={{
                color:
                  primaryColor,
                filter: `drop-shadow(0 0 12px ${primaryColor})`,
              }}
            />
          </div>

          {/* =================================================
              CENTRAL 3D PLATFORM
          ================================================= */}

          <div
            className="
              absolute
              left-1/2
              top-1/2
              h-[210px]
              w-[250px]
              -translate-x-1/2
              -translate-y-1/2
              sm:h-[260px]
              sm:w-[310px]
            "
            style={{
              transform:
                "translate(-50%, -50%) translateZ(60px)",
              transformStyle:
                "preserve-3d",
            }}
          >
            {/* Platform glow */}
            <div
              className="
                absolute
                left-1/2
                top-[60%]
                h-32
                w-56
                -translate-x-1/2
                rounded-full
                blur-3xl
                opacity-35
              "
              style={{
                background:
                  primaryColor,
              }}
            />

            {/* Back platform */}
            <div
              className="
                absolute
                bottom-0
                left-1/2
                h-20
                w-[230px]
                -translate-x-1/2
                rounded-[2rem]
                border
                border-white/10
                shadow-2xl
                sm:h-24
                sm:w-[290px]
              "
              style={{
                background: `linear-gradient(135deg, ${secondaryColor}, #050812)`,
                transform:
                  "translateZ(-35px) rotateX(62deg)",
                transformOrigin:
                  "center bottom",
              }}
            />

            {/* Main platform */}
            <div
              className="
                absolute
                bottom-8
                left-1/2
                h-20
                w-[210px]
                -translate-x-1/2
                rounded-[1.5rem]
                border
                border-white/10
                shadow-[0_30px_60px_rgba(0,0,0,0.45)]
                sm:h-24
                sm:w-[270px]
              "
              style={{
                background: `linear-gradient(145deg, ${secondaryColor}, #07101f)`,
                transform:
                  "translateZ(25px) rotateX(68deg)",
                transformOrigin:
                  "center bottom",
              }}
            />

            {/* Academy emblem */}
            <div
              className="
                absolute
                left-1/2
                top-1/2
                flex
                h-32
                w-32
                -translate-x-1/2
                -translate-y-1/2
                items-center
                justify-center
                rounded-full
                border
                border-white/10
                bg-black/30
                shadow-[0_20px_60px_rgba(0,0,0,0.45)]
                backdrop-blur-md
                sm:h-40
                sm:w-40
              "
              style={{
                transform:
                  "translate(-50%, -50%) translateZ(80px)",
              }}
            >
              <div
                className="
                  absolute
                  inset-3
                  rounded-full
                  border
                  border-dashed
                  opacity-60
                "
                style={{
                  borderColor:
                    primaryColor,
                }}
              />

              <div
                className="
                  relative
                  flex
                  h-20
                  w-20
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-2xl
                  bg-white
                  shadow-xl
                  sm:h-24
                  sm:w-24
                "
              >
                {logoUrl && failedLogoUrl !== logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={`${academyName} logo`}
                    className="h-full w-full object-contain p-2"
                    onError={() => setFailedLogoUrl(logoUrl)}
                  />
                ) : (
                  <span
                    role="img"
                    aria-label={`${academyName} logo`}
                    className="flex h-full w-full items-center justify-center bg-[#e44498] text-2xl font-extrabold text-white"
                  >
                    {academyInitials}
                  </span>
                )}
              </div>
            </div>

            {/* Front gold edge */}
            <div
              className="
                absolute
                bottom-0
                left-1/2
                h-2
                w-[220px]
                -translate-x-1/2
                rounded-full
                sm:w-[280px]
              "
              style={{
                background:
                  primaryColor,
                boxShadow: `0 0 25px ${primaryColor}`,
                transform:
                  "translateZ(70px)",
              }}
            />
          </div>

          {/* =================================================
              FOCUS CARD
          ================================================= */}

          <div
            className="
              absolute
              left-[0%]
              top-[35%]
              w-[155px]
              rounded-2xl
              border
              border-white/10
              bg-[#0b1324]/90
              p-4
              shadow-[0_20px_50px_rgba(0,0,0,0.35)]
              backdrop-blur-xl
              animate-[heroFloat_6s_ease-in-out_infinite]
              sm:left-[1%]
              sm:w-[185px]
            "
            style={{
              transform:
                "translateZ(120px)",
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="
                  flex
                  h-9
                  w-9
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-white/5
                "
              >
                <Target
                  size={17}
                  style={{
                    color:
                      primaryColor,
                  }}
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-white/40">
                  Focus
                </p>

                <p className="mt-0.5 text-sm font-extrabold text-white">
                  Every session
                </p>
              </div>
            </div>

            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full w-[72%] rounded-full"
                style={{
                  background:
                    primaryColor,
                }}
              />
            </div>
          </div>

          {/* =================================================
              PROGRESS CARD
          ================================================= */}

          <div
            className="
              absolute
              bottom-[17%]
              right-[-1%]
              w-[175px]
              rounded-2xl
              border
              border-white/10
              bg-[#0b1324]/90
              p-4
              shadow-[0_20px_50px_rgba(0,0,0,0.4)]
              backdrop-blur-xl
              animate-[heroFloatReverse_6.5s_ease-in-out_infinite]
              sm:w-[205px]
            "
            style={{
              transform:
                "translateZ(135px)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-white/5
                "
              >
                <Award
                  size={19}
                  style={{
                    color:
                      primaryColor,
                  }}
                />
              </div>

              <div>
                <p className="text-[10px] font-semibold text-white/40">
                  Progress
                </p>

                <p className="text-sm font-extrabold text-white">
                  Belt by belt
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-1.5">
              {[
                1,
                2,
                3,
                4,
                5,
              ].map(
                (item) => (
                  <span
                    key={item}
                    className="
                      h-1.5
                      flex-1
                      rounded-full
                    "
                    style={{
                      background:
                        item <= 3
                          ? primaryColor
                          : "rgba(255,255,255,0.12)",
                    }}
                  />
                ),
              )}
            </div>
          </div>

          {/* =================================================
              COMMUNITY CARD
          ================================================= */}

          <div
            className="
              absolute
              bottom-[2%]
              left-[7%]
              hidden
              items-center
              gap-3
              rounded-2xl
              border
              border-white/10
              bg-[#0b1324]/85
              px-4
              py-3
              shadow-2xl
              backdrop-blur-xl
              sm:flex
            "
            style={{
              transform:
                "translateZ(100px)",
            }}
          >
            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-xl
                bg-white/5
              "
            >
              <Users
                size={17}
                style={{
                  color:
                    primaryColor,
                }}
              />
            </div>

            <div>
              <p className="text-[10px] text-white/40">
                Community
              </p>

              <p className="text-xs font-extrabold text-white">
                Grow together
              </p>
            </div>
          </div>

          {/* =================================================
              LOCATION / BRAND LABEL
          ================================================= */}

          <div
            className="
              absolute
              left-1/2
              top-[8%]
              flex
              -translate-x-1/2
              items-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-black/25
              px-4
              py-2
              text-[9px]
              font-bold
              uppercase
              tracking-[0.18em]
              text-white/55
              backdrop-blur-xl
              sm:text-[10px]
            "
            style={{
              transform:
                "translateX(-50%) translateZ(150px)",
            }}
          >
            <Sparkles
              size={12}
              style={{
                color:
                  primaryColor,
              }}
            />

            {academyName}
          </div>

          {/* =================================================
              BOTTOM MESSAGE
          ================================================= */}

          <div
            className="
              absolute
              bottom-[2%]
              left-1/2
              w-[min(88%,430px)]
              -translate-x-1/2
              text-center
            "
            style={{
              transform:
                "translateX(-50%) translateZ(80px)",
            }}
          >
            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-[0.24em]
                sm:text-[10px]
              "
              style={{
                color:
                  primaryColor,
              }}
            >
              Train with intention
            </p>

            <p className="mt-1 text-xs font-semibold text-white/70 sm:text-sm">
              {tagline}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
