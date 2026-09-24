import React from "react";

interface SarAiAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | number;
  className?: string;
  isThinking?: boolean;
  withAura?: boolean;
  withGlow?: boolean;
}

export function SarAiAvatar({
  size = "md",
  className = "",
  isThinking = false,
  withAura = true,
  withGlow = true,
}: SarAiAvatarProps) {
  // Determine pixel dimension based on size prop
  const getDimension = () => {
    if (typeof size === "number") return size;
    switch (size) {
      case "xs":
        return 28;
      case "sm":
        return 36;
      case "md":
        return 48;
      case "lg":
        return 64;
      case "xl":
        return 88;
      case "2xl":
        return 120;
      default:
        return 48;
    }
  };

  const dim = getDimension();

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: dim, height: dim }}
      aria-label="Sar IA Avatar"
    >
      {/* Ambient Pulsing Aura behind silhouette */}
      {withAura && (
        <div
          className={`absolute inset-0 rounded-full blur-md -z-10 transition-all duration-700 ${
            isThinking
              ? "bg-gradient-to-tr from-emerald-500/50 via-teal-400/40 to-primary/60 scale-125 animate-pulse"
              : "bg-gradient-to-tr from-primary/30 via-emerald-500/25 to-teal-400/30 scale-110"
          }`}
        />
      )}

      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md overflow-visible"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="sarAIBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#052e16" />
            <stop offset="50%" stopColor="#064e3b" />
            <stop offset="100%" stopColor="#022c22" />
          </linearGradient>

          <linearGradient id="sarAISilhouetteGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="40%" stopColor="#10b981" />
            <stop offset="85%" stopColor="#047857" />
            <stop offset="100%" stopColor="#064e3b" />
          </linearGradient>

          <linearGradient id="sarAIEyeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          <linearGradient id="sarAICircuitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#a7f3d0" stopOpacity="1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.8" />
          </linearGradient>

          <radialGradient id="sarAIEyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a7f3d0" stopOpacity="1" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#047857" stopOpacity="0" />
          </radialGradient>

          {/* Glow Filters */}
          <filter id="sarAIGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="sarAIEyeFilter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Embedded Dynamic Animation Styles */}
          <style>{`
            @keyframes sarEyeBlink {
              0%, 88%, 94%, 100% {
                transform: scaleY(1);
              }
              91% {
                transform: scaleY(0.08);
              }
            }

            @keyframes sarEyeGaze {
              0%, 100% {
                transform: translate(0px, 0px);
              }
              25% {
                transform: translate(1.8px, -0.4px);
              }
              50% {
                transform: translate(0px, 0.4px);
              }
              75% {
                transform: translate(-1.8px, -0.4px);
              }
            }

            @keyframes sarHaloBreath {
              0%, 100% {
                opacity: 0.65;
                transform: scale(1);
              }
              50% {
                opacity: 0.95;
                transform: scale(1.04);
              }
            }

            @keyframes sarSynapsePulse {
              0%, 100% {
                stroke-dashoffset: 0;
                opacity: 0.4;
              }
              50% {
                stroke-dashoffset: 20;
                opacity: 0.95;
              }
            }

            @keyframes sarThinkOrbit {
              0% {
                transform: rotate(0deg);
              }
              100% {
                transform: rotate(360deg);
              }
            }

            .sar-eye-anim {
              transform-origin: 50% 41.5%;
              animation: sarEyeBlink 3.8s ease-in-out infinite;
            }

            .sar-gaze-anim {
              animation: sarEyeGaze 6s ease-in-out infinite;
            }

            .sar-halo-anim {
              transform-origin: 50% 50%;
              animation: sarHaloBreath 4s ease-in-out infinite;
            }

            .sar-synapse-anim {
              stroke-dasharray: 4 6;
              animation: sarSynapsePulse 2.8s linear infinite;
            }

            .sar-think-orbit {
              transform-origin: 50% 50%;
              animation: sarThinkOrbit 2s linear infinite;
            }
          `}</style>
        </defs>

        {/* Outer Tech Pod / Capsule Background */}
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          rx="28"
          fill="url(#sarAIBgGrad)"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeOpacity="0.45"
        />

        {/* Ambient Orbiting Ring when Thinking */}
        {isThinking && (
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#sarAICircuitGrad)"
            strokeWidth="2"
            strokeDasharray="18 40"
            fill="none"
            className="sar-think-orbit"
            filter="url(#sarAIGlowFilter)"
          />
        )}

        {/* Halo Glow behind head */}
        <circle
          cx="50"
          cy="42"
          r="24"
          fill="#10b981"
          fillOpacity="0.22"
          className="sar-halo-anim"
          filter="url(#sarAIGlowFilter)"
        />

        {/* Cyber Hologram grid lines in background */}
        <g opacity="0.15" stroke="#34d399" strokeWidth="0.75">
          <line x1="20" y1="35" x2="80" y2="35" strokeDasharray="2 3" />
          <line x1="20" y1="50" x2="80" y2="50" strokeDasharray="2 3" />
          <line x1="20" y1="65" x2="80" y2="65" strokeDasharray="2 3" />
          <line x1="35" y1="20" x2="35" y2="80" strokeDasharray="2 3" />
          <line x1="50" y1="15" x2="50" y2="85" strokeDasharray="2 3" />
          <line x1="65" y1="20" x2="65" y2="80" strokeDasharray="2 3" />
        </g>

        {/* AI Humanoid Silhouette Body (Shoulders & Torso) */}
        <path
          d="M20 95 C20 78 30 70 41 68 L44 67 L44 58 L56 58 L56 67 L59 68 C70 70 80 78 80 95 Z"
          fill="url(#sarAISilhouetteGrad)"
          opacity="0.95"
        />

        {/* Collar & Cyber Body Core Accents */}
        <path
          d="M42 68 L50 78 L58 68"
          stroke="#6ee7b7"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.8"
        />
        <circle cx="50" cy="84" r="2.5" fill="#a7f3d0" opacity="0.9" />

        {/* AI Silhouette Head & Face Contour */}
        <path
          d="M50 18 C37 18 31 27 31 39 C31 51 38 60 50 60 C62 60 69 51 69 39 C69 27 63 18 50 18 Z"
          fill="url(#sarAISilhouetteGrad)"
        />

        {/* Sleek Ear / Audio Interface nodes */}
        <rect x="29" y="37" width="2.5" height="9" rx="1.25" fill="#a7f3d0" opacity="0.85" />
        <rect x="68.5" y="37" width="2.5" height="9" rx="1.25" fill="#a7f3d0" opacity="0.85" />

        {/* Neural Synapse Circuit Lines across the temple */}
        <path
          d="M32 32 Q40 25 50 24 Q60 25 68 32"
          stroke="#a7f3d0"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          className="sar-synapse-anim"
        />

        {/* Interactive / Animated Gaze & Blinking Cyber Eyes Group */}
        <g className="sar-gaze-anim">
          <g className="sar-eye-anim">
            {/* Left Eye Visor Glow */}
            <ellipse
              cx="42.5"
              cy="41.5"
              rx="4.8"
              ry="2.6"
              fill="url(#sarAIEyeGrad)"
              filter={withGlow ? "url(#sarAIEyeFilter)" : undefined}
            />
            {/* Left Eye Bright Pupil / Lens Core */}
            <ellipse cx="42.5" cy="41.5" rx="2.4" ry="1.4" fill="#ffffff" />
            <circle cx="43.3" cy="40.8" r="0.7" fill="#ffffff" />

            {/* Right Eye Visor Glow */}
            <ellipse
              cx="57.5"
              cy="41.5"
              rx="4.8"
              ry="2.6"
              fill="url(#sarAIEyeGrad)"
              filter={withGlow ? "url(#sarAIEyeFilter)" : undefined}
            />
            {/* Right Eye Bright Pupil / Lens Core */}
            <ellipse cx="57.5" cy="41.5" rx="2.4" ry="1.4" fill="#ffffff" />
            <circle cx="58.3" cy="40.8" r="0.7" fill="#ffffff" />

            {/* Futuristic Brow / Visor Highlight Arch */}
            <path
              d="M37 36 C40 34.5 45 35 48 37"
              stroke="#6ee7b7"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
            <path
              d="M63 36 C60 34.5 55 35 52 37"
              stroke="#6ee7b7"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
          </g>
        </g>

        {/* Sleek AI Smile / Vocal Wave Accent */}
        <path
          d="M46 51 Q50 53.5 54 51"
          stroke="#a7f3d0"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />

        {/* Spark of Intellect / Star in the corner */}
        <path
          d="M74 22 L75.5 25.5 L79 27 L75.5 28.5 L74 32 L72.5 28.5 L69 27 L72.5 25.5 Z"
          fill="#34d399"
          className="sar-halo-anim"
          opacity="0.9"
        />
        <circle cx="24" cy="26" r="1.5" fill="#a7f3d0" className="sar-halo-anim" opacity="0.8" />
      </svg>
    </div>
  );
}
