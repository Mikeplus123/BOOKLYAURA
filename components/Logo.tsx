// Bookly brand mark — vector version of the book-with-bookmark logo.
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      {/* page block (behind) */}
      <rect x="13" y="13" width="45" height="45" rx="10" fill="var(--logo-dark, #0A5B4A)" />
      <rect x="17" y="43" width="38" height="11" rx="5.5" fill="var(--logo-paper, #F6F0E1)" />
      <rect x="43" y="17" width="11" height="34" rx="5.5" fill="var(--logo-paper, #F6F0E1)" />
      {/* cover */}
      <path d="M15 6h28a7 7 0 017 7v27a7 7 0 01-7 7H15a9 9 0 01-9-9V15a9 9 0 019-9z" fill="var(--logo-cover, #0B6652)" />
      {/* spine shade */}
      <path d="M15 6h3v41h-3a9 9 0 01-9-9V15a9 9 0 019-9z" fill="var(--logo-spine, #064C3D)" />
      {/* ribbon */}
      <path d="M29 6h9v15l-4.5-3.4L29 21z" fill="var(--logo-ribbon, #D9B45C)" />
    </svg>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <LogoMark size={size} />
      <span className="logo-word">Bookly</span>
    </span>
  );
}
