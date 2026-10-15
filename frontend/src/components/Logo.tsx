import { Link } from 'react-router'

/** Marca: lente + feixe de projetor. */
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo__mark">
      <defs>
        <linearGradient id="eunis-beam" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B7A3FF" />
          <stop offset="1" stopColor="#FFB648" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="16" r="9" fill="none" stroke="url(#eunis-beam)" strokeWidth="3" />
      <path d="M17 11.5 30 6v20l-13-5.5z" fill="url(#eunis-beam)" opacity=".9" />
      <circle cx="12" cy="16" r="3" fill="#F4F0E8" />
    </svg>
  )
}

export function Logo({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`logo ${className}`} aria-label="EUNIS — início">
      <LogoMark />
      <span className="logo__word">EUNIS</span>
    </Link>
  )
}
