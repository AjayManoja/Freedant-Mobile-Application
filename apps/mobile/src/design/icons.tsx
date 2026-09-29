import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The prototype's hand-drawn icon set (design/prototype/src/ui.tsx and pages), path for
 * path: a 24-unit grid, 1.8 stroke, round caps and joins, drawn in the current colour.
 */
export interface IconProps {
  size?: number;
  color?: string;
  /** Rotation in degrees, for the chevron's `-rotate-90` style variants. */
  rotate?: number;
}

type Shape = ReactNode | ((color: string) => ReactNode);

function icon(shapes: Shape, defaults: { size: number; filled?: boolean; strokeWidth?: number }) {
  return function Icon({ size = defaults.size, color = '#1b2b3a', rotate }: IconProps) {
    const body = typeof shapes === 'function' ? shapes(color) : shapes;
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={defaults.filled ? color : 'none'}
        stroke={defaults.filled ? 'none' : color}
        strokeWidth={defaults.strokeWidth ?? 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
      >
        {body}
      </Svg>
    );
  };
}

export const ArrowLeft = icon(<Path d="M19 12H5M11 18l-6-6 6-6" />, { size: 24 });
export const CheckCircle = icon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M8 12l2.5 2.5L16 9" />
  </>,
  { size: 16 },
);
export const Trophy = icon(<Path d="M6 4h12v4a6 6 0 01-12 0V4zM6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3M9 20h6M12 14v6" />, { size: 16 });
export const Users = icon(
  <>
    <Circle cx="9" cy="8" r="3" />
    <Path d="M3 20a6 6 0 0112 0M16 6a3 3 0 010 6M18 20a6 6 0 00-3-5" />
  </>,
  { size: 16 },
);
export const Play = icon(<Path d="M8 5v14l11-7z" />, { size: 18, filled: true });
export const Hourglass = icon(<Path d="M6 3h12M6 21h12M7 3c0 4 10 5 10 9s-10 5-10 9M17 3c0 4-10 5-10 9" />, { size: 18 });
export const Clock = icon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </>,
  { size: 18 },
);
export const Calendar = icon(
  <>
    <Rect x="3" y="5" width="18" height="16" rx="2" />
    <Path d="M3 9h18M8 3v4M16 3v4" />
  </>,
  { size: 20 },
);
export const Send = icon(<Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />, { size: 20 });
export const Upload = icon(<Path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 15V3M7 8l5-5 5 5" />, { size: 20 });
export const Chevron = icon(<Path d="M6 9l6 6 6-6" />, { size: 16 });
export const Info = icon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 16v-4M12 8h.01" />
  </>,
  { size: 18 },
);
export const Shield = icon(
  <>
    <Path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    <Path d="M9 12l2 2 4-4" />
  </>,
  { size: 16 },
);
export const Megaphone = icon(<Path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1zM14 8a4 4 0 010 8M17 5a8 8 0 010 14" />, { size: 32 });
export const Chat = icon(<Path d="M4 5h16v11H8l-4 4V5z" />, { size: 20 });
export const Home = icon(<Path d="M3 11l9-8 9 8M5 10v10h14V10" />, { size: 22 });
export const Camera = icon(
  <>
    <Path d="M3 8h4l2-2h6l2 2h4v11H3V8z" />
    <Circle cx="12" cy="13" r="3.5" />
  </>,
  { size: 16 },
);
export const Mail = icon(
  <>
    <Rect x="3" y="5" width="18" height="14" rx="2" />
    <Path d="M3 7l9 6 9-6" />
  </>,
  { size: 20 },
);
export const Search = icon(
  <>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M21 21l-4-4" />
  </>,
  { size: 22 },
);
export const Plus = icon(<Path d="M12 5v14M5 12h14" />, { size: 24 });
export const Fire = icon(<Path d="M12 3c1 3-2 4-2 7a2 2 0 004 0c0-1 0-1.5.5-2 1 2 2.5 3 2.5 5.5a5 5 0 01-10 0C7 12 10 9 12 3z" />, { size: 16 });
export const Star = icon(<Path d="M12 3l2.6 5.6 6 .6-4.5 4 1.3 6L12 16.9 6.6 19.3l1.3-6-4.5-4 6-.6z" />, { size: 16, filled: true });
export const Bell = icon(<Path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />, { size: 20 });
export const Globe = icon(
  <>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9S9.5 5.5 12 3z" />
  </>,
  { size: 18 },
);
export const Lock = icon(
  <>
    <Rect x="4" y="10" width="16" height="11" rx="2" />
    <Path d="M8 10V7a4 4 0 018 0v3" />
    <Path d="M12 15v2" />
  </>,
  { size: 18 },
);
export const Moon = icon(<Path d="M21 13A9 9 0 1111 3a7 7 0 0010 10z" />, { size: 18 });
export const Trash = icon(
  <Path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13M10 11v6M14 11v6" />,
  { size: 18 },
);

/** Generic icon from raw path data, for page-local icons that appear once. */
export function PathIcon({ d, size = 20, color = '#1b2b3a', filled, strokeWidth = 1.8 }: IconProps & { d: string; filled?: boolean; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={d} />
    </Svg>
  );
}
