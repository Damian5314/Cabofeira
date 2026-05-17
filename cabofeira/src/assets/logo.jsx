import React from "react";

// CaboFeira logo: stylised group of people themed after the Cape Verde flag
// (deep blue, white stripe and red stripe with yellow stars).
export function LogoMark({ size = 40 }) {
  return (
    <svg
      viewBox="0 0 120 110"
      width={size}
      height={size * (110 / 120)}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CaboFeira logo"
    >
      <defs>
        <clipPath id="people-clip">
          {/* Five person silhouettes side by side */}
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i} transform={`translate(${10 + i * 22}, 0)`}>
              <circle cx="10" cy="14" r="9" />
              <path d="M0 28 Q0 24 5 24 L15 24 Q20 24 20 28 L20 105 L0 105 Z" />
            </g>
          ))}
        </clipPath>
      </defs>

      <g clipPath="url(#people-clip)">
        {/* Blue field */}
        <rect x="0" y="0" width="120" height="110" fill="#003893" />
        {/* White stripe */}
        <rect x="0" y="58" width="120" height="20" fill="#ffffff" />
        {/* Red stripe */}
        <rect x="0" y="78" width="120" height="6" fill="#cf2027" />

        {/* Ten yellow stars arranged in a curve */}
        {[
          [18, 46], [30, 42], [42, 39], [54, 38], [66, 38],
          [78, 39], [90, 42], [102, 46],
          [36, 70], [84, 70],
        ].map(([cx, cy], i) => (
          <Star key={i} cx={cx} cy={cy} r={3} />
        ))}
      </g>
    </svg>
  );
}

function Star({ cx, cy, r }) {
  // 5-point star using polygon points
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r / 2.4;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return <polygon points={points.join(" ")} fill="#f7d116" />;
}

export function LogoFull({ height = 38 }) {
  return (
    <span className="cf-logo-full" style={{ height }}>
      <LogoMark size={height} />
      <span className="cf-logo-text">
        <span className="cf-logo-title">CaboFeira</span>
        <span className="cf-logo-tagline">Mercado Online de Cabo Verde</span>
      </span>
    </span>
  );
}
