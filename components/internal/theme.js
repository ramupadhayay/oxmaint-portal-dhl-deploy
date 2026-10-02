// Day and night for the staff screens.
//
// Two token sets with the same keys, shared by the sign-in page and the usage
// screen so the toggle means the same thing on both and the choice carries
// across them. Everything reads a token rather than naming a colour — a value
// written straight into a style is a value that only exists in one theme.

export const THEMES = {
  light: {
    bg: '#f5f7fb', panel: '#ffffff', panel2: '#fafbfd',
    ink: '#0f172a', sub: '#475569', mute: '#94a3b8',
    line: '#e4e9f0', hair: '#f1f4f9',
    accent: '#0f766e', writes: '#4338ca',
    green: '#059669', amber: '#b45309', red: '#dc2626',
    noteBg: '#fffbeb', noteInk: '#78350f', noteEdge: '#f59e0b',
    field: '#ffffff', fieldEdge: '#cbd5e1',
    shadow: '0 1px 2px rgba(15,23,42,.05)',
    lift: '0 18px 44px rgba(15,23,42,.10)',
  },
  dark: {
    bg: '#0a0f1e', panel: '#131a2d', panel2: '#111827',
    ink: '#e9edf7', sub: '#a3b0c9', mute: '#6b7a96',
    line: '#252f4a', hair: '#1c2440',
    accent: '#2dd4bf', writes: '#8b93f8',
    green: '#34d399', amber: '#fbbf24', red: '#f87171',
    noteBg: '#1f1a0d', noteInk: '#fcd34d', noteEdge: '#a16207',
    field: '#0d1424', fieldEdge: '#2b3654',
    shadow: '0 1px 2px rgba(0,0,0,.4)',
    lift: '0 18px 44px rgba(0,0,0,.45)',
  },
}

export const THEME_KEY = 'internal.theme'

/**
 * The remembered theme, else the machine's own setting, else light.
 *
 * Call this from an effect and never from an initial state: neither
 * localStorage nor matchMedia exists on the server, and a first render that
 * disagrees with the second is a hydration mismatch.
 */
export function preferredTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* fall through to light */ }
  return 'light'
}

export function rememberTheme(mode) {
  try { localStorage.setItem(THEME_KEY, mode) } catch { /* not remembered, still switched */ }
}
