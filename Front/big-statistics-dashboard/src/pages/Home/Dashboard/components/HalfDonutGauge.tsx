// HalfDonutGauge.tsx
import React from "react";

type HalfDonutGaugeProps = {
  plan: number;
  fact: number;
  // Optional: if you already have percent from API you can pass it,
  // otherwise it will be calculated from plan/fact.
  percent?: number;
  className?: string;

  // Visual tuning
  strokeWidth?: number; // default 14
  height?: number;      // svg height, default 140
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const getColorByPercentage = (percentage: number) => {
  if (percentage < 75) return "#b91c1c"; // red-700
  if (percentage < 95) return "#ea580c"; // orange-600
  return "#15803d"; // green-700
};

export const HalfDonutGauge: React.FC<HalfDonutGaugeProps> = ({
  plan,
  fact,
  percent,
  className,
  strokeWidth = 14,
  height = 140,
}) => {
  const safePlan = plan > 0 ? plan : 0;
  const rawPct = percent ?? (safePlan > 0 ? (fact / safePlan) * 100 : 0);
  const pct = clamp(rawPct, 0, 999); // keep number for text
  const progress = clamp(safePlan > 0 ? fact / safePlan : 0, 0, 1); // gauge fill only 0..100%

  const color = getColorByPercentage(pct);

  // SVG geometry
  const width = 280; // internal viewBox width
  const cx = width / 2;
  const cy = width / 2;
  const r = (width / 2) - strokeWidth - 4;

  // We render a full circle but show only top half via clipPath.
  const circumference = 2 * Math.PI * r;
  const dashArray = circumference;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${width / 2 + strokeWidth + 12}`}
        className="w-full"
        style={{ height }}
      >
        <defs>
          {/* Show only top half */}
          <clipPath id="halfClip">
            <rect x="0" y="0" width={width} height={width / 2 + 6} />
          </clipPath>

          {/* Optional: light "reference" segments like in the ref image */}
          <linearGradient id="refSeg1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="refSeg2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="refSeg3" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>

        <g clipPath="url(#halfClip)">
          {/* Background arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Decorative segments (optional, subtle): draw 3 arcs under progress */}
          {/* If you don't want them, just delete these 3 circles. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke="url(#refSeg1)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${circumference * 0.28} ${circumference}`}
            strokeDashoffset={circumference * 0.53}
            opacity={0.35}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke="url(#refSeg2)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${circumference * 0.18} ${circumference}`}
            strokeDashoffset={circumference * 0.25}
            opacity={0.28}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke="url(#refSeg3)"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${circumference * 0.18} ${circumference}`}
            strokeDashoffset={circumference * 0.05}
            opacity={0.22}
          />

          {/* Progress arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            // Rotate so the start is at left, and it fills towards right (top arc)
            transform={`rotate(180 ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 600ms ease, stroke 300ms ease" }}
          />
        </g>
      </svg>
    </div>
  );
};
