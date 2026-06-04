// Decorative neon wall signage for the hero — dive-bar atmosphere. Purely visual.
export default function NeonSigns() {
  return (
    <div className="neon-signs" aria-hidden="true">
      <span className="neon-sign neon-block neon-amber flick-3 neon-pos-bar">Bar</span>

      <span className="neon-sign neon-icon neon-cyan flick-2 neon-pos-can">
        <svg viewBox="0 0 64 64" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {/* body with rounded bottom */}
          <path d="M23 17 L23 52 Q23 56 27 56 L37 56 Q41 56 41 52 L41 17" />
          {/* tapered neck up to the lid */}
          <path d="M23 17 L26 12 L38 12 L41 17" />
          {/* curved lid rim */}
          <path d="M26 12 Q32 9.5 38 12" />
          {/* pull tab */}
          <ellipse cx="32" cy="13" rx="3" ry="1.3" />
          {/* lower rolled rim */}
          <path d="M23 49 L41 49" />
        </svg>
      </span>

      <span className="neon-sign neon-script neon-violet flick-4 neon-pos-live">
        live music
      </span>

      <span className="neon-sign neon-icon neon-green flick-1 neon-pos-martini">
        <svg viewBox="0 0 64 64" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14h44L34 38v14" />
          <path d="M22 52h24" />
          <path d="M18 22h28" />
        </svg>
      </span>
    </div>
  );
}
