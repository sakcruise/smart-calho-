/** A jar that fills with stars toward the goal. Pure SVG, sized by its container width. */
export function StarJar({ value, target, colour, className }: { value: number; target: number; colour: string; className?: string }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const top = 46, bottom = 196
  const fillTop = bottom - (bottom - top) * pct
  // Up to 18 star specks scattered inside the filled part, deterministic so they don't jump around
  const specks = Array.from({ length: Math.min(18, Math.round(pct * 18)) }, (_, i) => ({
    x: 40 + ((i * 37) % 80),
    y: bottom - 14 - ((i * 53) % Math.max(8, bottom - fillTop - 20)),
  }))
  return (
    <svg viewBox="0 0 160 210" role="img" aria-label={`${value} of ${target} stars`} className={className}>
      <defs>
        <clipPath id={`jar-${colour.slice(1)}`}>
          <path d="M34 44 h92 v10 q14 10 14 34 v96 q0 16 -16 16 H36 q-16 0 -16 -16 V88 q0 -24 14 -34 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#jar-${colour.slice(1)})`}>
        <rect x="0" y="0" width="160" height="210" fill="#FFFFFF" />
        <rect x="0" y={fillTop} width="160" height={210 - fillTop} fill={colour} opacity="0.85" style={{ transition: 'y .6s ease, height .6s ease' }} />
        {specks.map((p, i) => (
          <path key={i} transform={`translate(${p.x} ${p.y}) scale(0.55)`} d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" fill="#FFD66B" />
        ))}
      </g>
      <path d="M34 44 h92 v10 q14 10 14 34 v96 q0 16 -16 16 H36 q-16 0 -16 -16 V88 q0 -24 14 -34 Z" fill="none" stroke="#23201A" strokeWidth="5" strokeLinejoin="round" />
      <rect x="28" y="22" width="104" height="24" rx="8" fill={colour} stroke="#23201A" strokeWidth="5" />
      <path d="M48 100 q-6 30 0 60" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="6" fill="none" strokeLinecap="round" />
    </svg>
  )
}
