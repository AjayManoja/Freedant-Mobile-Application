/**
 * Design tokens from design/tokens/tokens.json, plus the semantic status colours added in
 * docs/02-design/UI_TOKENS.md §1.2. Components never use literal colours.
 */
export const colors = {
  teal: '#0d8074',
  tealDark: '#0a6b60',
  ink: '#1b2b3a',
  slate: '#6b7d8c',
  /** UI_TOKENS §1.1: slate fails 4.5:1 on canvas; use this for small text on canvas. */
  slateStrong: '#56687a',
  mint: '#e8f5f1',
  canvas: '#f2f4f5',
  white: '#ffffff',
  border: '#e3e8eb',
  success: '#0f7a3d',
  successTint: '#e6f4ec',
  warning: '#a35a00',
  warningTint: '#fdf1e2',
  danger: '#b3261e',
  dangerTint: '#fbeaea',
  overlay: 'rgba(27, 43, 58, 0.5)',
  /** Leaderboard podium; always paired with the rank and a trophy icon. */
  gold: '#c9a227',
  silver: '#9aa5ad',
  bronze: '#b0703c',
} as const;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extrabold: 'Poppins_800ExtraBold',
} as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

/** NFR-UX-03: touch targets at least 44×44 pt. */
export const minTouch = 44;

/** tokens.json layout.app-max-width: the web export keeps the phone-width column. */
export const appMaxWidth = 430;

export const shadow = {
  shadowColor: '#1b2b3a',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
} as const;
