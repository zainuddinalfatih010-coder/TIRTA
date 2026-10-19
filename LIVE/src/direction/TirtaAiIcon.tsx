/** Water orb + four-point sparkle: a compact mark for TIRTA's AI entry and analysis mode. */
export function TirtaAiIcon({ size = 24 }: { size?: number }) {
  return <svg className="tirta-ai-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M14 4.8a8.1 8.1 0 1 0 5.2 5.2" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round"/>
    <path d="M3.5 14.8c3.6 1.4 7.5-4.4 14.5-2.2M5.6 18c3.1.8 7.5-3.8 11.2-3.4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/>
    <path d="m18 1.7 1.35 3.95L23.3 7l-3.95 1.35L18 12.3l-1.35-3.95L12.7 7l3.95-1.35L18 1.7Z" fill="currentColor"/>
  </svg>;
}
