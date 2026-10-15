// Conjunto de ícones em traço (24×24, stroke 1.75). Decorativos por padrão (aria-hidden).
const P: Record<string, string> = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  heart:
    'M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  bookmark: 'M6.5 4.5h11v16l-5.5-4-5.5 4v-16Z',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9L12 3.5Z',
  x: 'M6 6l12 12M18 6 6 18',
  left: 'm14.5 6-6 6 6 6',
  right: 'm9.5 6 6 6-6 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4v-9.5Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18',
  users:
    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5m1-9.2a3 3 0 1 0 0-6m2 15.2h3c0-2.6-1.6-4.6-4-5.3',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c0-3.9 3.4-6.5 7.5-6.5s7.5 2.6 7.5 6.5',
  list: 'M8.5 6.5h11m-11 5.5h11m-11 5.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  chat: 'M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1.4-4.5A7.5 7.5 0 1 1 20 12Z',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  logout: 'M14 4.5h4.5v15H14M10 8l-4 4 4 4m-4-4h10',
  trash: 'M5 7h14m-9-3h4m-7 3 .8 12.5h8.4L17 7',
  edit: 'm14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z',
  lock: 'M7 10.5V8a5 5 0 0 1 10 0v2.5M5.5 10.5h13v10h-13v-10Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c-2.5 2.6-3.5 5.6-3.5 9s1 6.4 3.5 9m0-18c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9M3.5 9h17m-17 6h17',
  film: 'M4 4.5h16v15H4v-15Zm4 0v15m8-15v15M4 9h4m8 0h4M4 15h4m8 0h4',
  tv: 'M3.5 7h17v12h-17V7Zm5-3.5L12 7l3.5-3.5',
  play: 'M8 5.5v13l10-6.5-10-6.5Z',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  dot: 'M12 12h.01',
}

export type IconName = keyof typeof P

export function Icon({
  name,
  size = 20,
  filled = false,
  className,
  label,
}: {
  name: IconName
  size?: number
  filled?: boolean
  className?: string
  label?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      <path d={P[name]} />
    </svg>
  )
}
