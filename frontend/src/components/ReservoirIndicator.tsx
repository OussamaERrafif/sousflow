"use client";

interface ReservoirIndicatorProps {
  level: number;
  capacity?: number;
  showLabel?: boolean;
}

export function ReservoirIndicator({
  level,
  capacity = 100,
  showLabel = true,
}: ReservoirIndicatorProps) {
  const percentage = Math.min(100, Math.max(0, (level / capacity) * 100));

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        viewBox="0 0 120 160"
        className="w-24 h-32"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="1" />
          </linearGradient>
          <clipPath id="waterClip">
            <rect
              x="10"
              y={160 - (percentage * 1.1)}
              width="100"
              height={percentage * 1.1}
            />
          </clipPath>
          <filter id="waterGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d="M10 20 L10 140 Q10 155 25 155 L95 155 Q110 155 110 140 L110 20 Q110 10 100 10 L20 10 Q10 10 10 20 Z"
          fill="none"
          stroke="#64748B"
          strokeWidth="3"
          className="drop-shadow-lg"
        />

        <path
          d="M10 20 L10 140 Q10 155 25 155 L95 155 Q110 155 110 140 L110 20 Q110 10 100 10 L20 10 Q10 10 10 20 Z"
          fill="#1E293B"
          opacity="0.3"
        />

        <g clipPath="url(#waterClip)">
          <rect
            x="10"
            y="10"
            width="100"
            height="145"
            fill="url(#waterGradient)"
            filter="url(#waterGlow)"
          />

          <g className="water-waves">
            <path
              d="M5 100 Q20 90 35 100 T65 100 T95 100 T125 100"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="3"
              className="animate-pulse"
              style={{
                animation: "wave 2s ease-in-out infinite",
              }}
            />
            <path
              d="M0 120 Q20 110 40 120 T80 120 T120 120"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="2"
              className="animate-pulse"
              style={{
                animation: "wave 2.5s ease-in-out infinite 0.3s",
              }}
            />
            <path
              d="M10 135 Q25 128 40 135 T80 135 T110 135"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="2"
              className="animate-pulse"
              style={{
                animation: "wave 3s ease-in-out infinite 0.6s",
              }}
            />
          </g>
        </g>

        <line
          x1="5"
          y1={160 - percentage}
          x2="115"
          y2={160 - percentage}
          stroke="#22D3EE"
          strokeWidth="2"
          strokeDasharray="8 4"
          className="animate-pulse"
        />

        <circle
          cx="110"
          cy={160 - percentage}
          r="6"
          fill="#22D3EE"
          className="animate-pulse"
        />

        <circle
          cx="110"
          cy={160 - percentage}
          r="3"
          fill="#fff"
        />

        <g className="tick-marks">
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1="110"
                y1={160 - tick * 1.1}
                x2="115"
                y2={160 - tick * 1.1}
                stroke="#64748B"
                strokeWidth="1"
              />
              <text
                x="118"
                y={164 - tick * 1.1}
                fontSize="8"
                fill="#94A3B8"
                className="font-mono"
              >
                {tick}%
              </text>
            </g>
          ))}
        </g>
      </svg>

      {showLabel && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-sm font-bold text-cyan-400">
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes wave {
          0%,
          100% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(5px) translateY(-3px);
          }
        }
        .water-waves path {
          animation: wave 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}