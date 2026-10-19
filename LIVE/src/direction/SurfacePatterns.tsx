/** Material marks identify classes only; they encode no engineering parameter. */
export function SurfacePatterns({ prefix, raster = false }: { prefix: string; raster?: boolean }) {
  if (raster) return <>{(["roof", "paved", "soil", "vegetation", "porous"] as const).map(surface => <pattern key={surface} id={`${prefix}${surface}`} width={surface === "soil" || surface === "vegetation" ? 100 : 120} height={surface === "soil" || surface === "vegetation" ? 100 : 120} patternUnits="userSpaceOnUse"><image href={`/materials/${surface}.webp`} width={surface === "soil" || surface === "vegetation" ? 100 : 120} height={surface === "soil" || surface === "vegetation" ? 100 : 120} /></pattern>)}</>;
  return <>
    <pattern id={`${prefix}roof`} width="12" height="24" patternUnits="userSpaceOnUse">
      <rect width="12" height="24" fill="#d6835b" />
      <path d="M1 0V24M7 0V24" stroke="#874528" strokeWidth="1.2" opacity=".5" />
      <path d="M3 0V24M9 0V24" stroke="#f7c39d" strokeWidth="1.2" opacity=".65" />
      <path d="M0 12H12" stroke="#965736" strokeWidth=".5" opacity=".3" />
    </pattern>
    <pattern id={`${prefix}paved`} width="18" height="18" patternUnits="userSpaceOnUse">
      <rect width="18" height="18" fill="#aeb8be" />
      <path d="M0 0H18V18H0Z" stroke="#e7eeee" strokeWidth="1" fill="none" />
      <path d="M2 2H16V16" stroke="#798990" strokeWidth=".5" opacity=".4" fill="none" />
      <circle cx="8" cy="7" r=".6" fill="#edf4f5" opacity=".7" />
    </pattern>
    <pattern id={`${prefix}vegetation`} width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#a6c57b" />
      <path d="M4 9q-3-4-2-6M4 9q1-7 5-7M17 24q-2-7 2-10M17 24q2-4 6-3M27 8l-2-4" stroke="#628349" strokeWidth="1.2" fill="none" opacity=".65" />
      <path d="M11 16l3-4M5 27l2-4M26 19l2-3" stroke="#e5efc6" strokeWidth="1.3" opacity=".8" />
      <circle cx="12" cy="4" r="1.2" fill="#6d934e" opacity=".5" /><circle cx="7" cy="19" r=".8" fill="#e8f2ce" />
    </pattern>
    <pattern id={`${prefix}soil`} width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="#efd7af" />
      <path d="M5 8l2-1M17 23l3 1M23 7l1-2M9 19l1 2" stroke="#a77c47" strokeWidth="1" opacity=".5" />
      <circle cx="12" cy="4" r=".7" fill="#967141" /><circle cx="24" cy="18" r="1" fill="#ba9666" />
      <circle cx="3" cy="23" r=".6" fill="#86663c" /><circle cx="19" cy="12" r="1.4" fill="#fff0d5" />
    </pattern>
    <pattern id={`${prefix}porous`} width="18" height="18" patternUnits="userSpaceOnUse">
      <rect width="18" height="18" fill="#6ea8a9" />
      <path d="M0 0H18V18H0ZM9 0V18M0 9H18" fill="none" stroke="#cee6e0" strokeWidth="1.2" />
      <path d="M2 2H7V7H2ZM11 11H16V16H11Z" fill="#538d91" stroke="#93c0bc" strokeWidth=".5" opacity=".6" />
    </pattern>
  </>;
}
