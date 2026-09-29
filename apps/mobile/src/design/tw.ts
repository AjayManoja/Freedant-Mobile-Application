import { create, plugin } from 'twrnc';

/**
 * Tailwind for React Native, configured to the prototype's Tailwind v4 theme
 * (design/tokens/tokens.css), so screens reuse the design's class names verbatim and
 * render the same sizes. Differences from twrnc's v3 defaults are pinned here:
 * v4 radii, v4 shadows (as real CSS box-shadows) and v4's OKLCH palette converted to sRGB.
 */
const brand = {
  teal: { DEFAULT: '#0d8074', dark: '#0a6b60' },
  ink: '#1b2b3a',
  slate: '#6b7d8c',
  mint: '#e8f5f1',
  canvas: '#f2f4f5',
};

/** Tailwind v4 palette entries the design uses (OKLCH → sRGB). */
const v4 = {
  neutral: { 50: '#fafafa', 100: '#f5f5f5', 200: '#e5e5e5', 300: '#d4d4d4', 400: '#a1a1a1' },
  amber: { 50: '#fffbeb', 200: '#fee685', 300: '#ffd230', 400: '#ffb900', 500: '#fe9a00', 600: '#e17100', 700: '#bb4d00' },
  emerald: { 50: '#ecfdf5', 300: '#5ee9b5', 400: '#00d492', 500: '#00bc7d', 600: '#009966' },
  fuchsia: { 400: '#ed6aff', 500: '#e12afb' },
  indigo: { 50: '#eef2ff', 400: '#7c86ff', 500: '#615fff', 600: '#4f39f6' },
  orange: { 50: '#fff7ed', 300: '#ffb86a', 400: '#ff8904', 500: '#ff6900' },
  purple: { 600: '#9810fa' },
  red: { 50: '#fef2f2', 500: '#fb2c36' },
  rose: { 50: '#fff1f2', 300: '#ffa1ad', 400: '#ff637e', 500: '#ff2056', 600: '#ec003f' },
  slate: { 300: '#cad5e2', 400: '#90a1b9' },
  sky: { 50: '#f0f9ff', 500: '#00a6f4' },
  violet: { 50: '#f5f3ff', 500: '#8e51ff' },
};

export const shadows = {
  '2xs': '0 1px 0 0 rgba(0,0,0,0.05)',
  xs: '0 1px 2px 0 rgba(0,0,0,0.05)',
  sm: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
  md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
  xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
} as const;

const tw = create({
  theme: {
    extend: {
      colors: {
        ...brand,
        slate: { ...v4.slate, DEFAULT: brand.slate },
        neutral: v4.neutral,
        amber: v4.amber,
        emerald: v4.emerald,
        fuchsia: v4.fuchsia,
        indigo: v4.indigo,
        orange: v4.orange,
        purple: v4.purple,
        red: v4.red,
        rose: v4.rose,
        sky: v4.sky,
        violet: v4.violet,
      },
      borderRadius: { xs: '2px', sm: '4px', md: '6px', lg: '8px', xl: '12px', '2xl': '16px', '3xl': '24px', '4xl': '32px' },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities(
        Object.fromEntries(Object.entries(shadows).map(([k, v]) => [`shadow-${k}`, { boxShadow: v }])),
      );
      addUtilities({ shadow: { boxShadow: shadows.sm }, 'shadow-none': { boxShadow: 'none' } });
    }),
  ],
});

export default tw;

/** A CSS ring (`ring-N ring-color`) as a spread shadow, optionally layered over a shadow. */
export const ring = (width: number, color: string, shadow?: keyof typeof shadows) => ({
  boxShadow: [`0 0 0 ${width}px ${color}`, shadow ? shadows[shadow] : null].filter(Boolean).join(', '),
});

export const color = (name: string): string => tw.color(name) ?? name;
