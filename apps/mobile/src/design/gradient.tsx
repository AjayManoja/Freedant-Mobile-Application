import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

const DIR = {
  r: { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } },
  l: { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } },
  b: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  t: { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } },
  br: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  bl: { start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
  tr: { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
} as const;

/** `bg-gradient-to-{dir} from-… via-… to-…` from the design. */
export function Gradient({
  dir,
  colors,
  style,
  children,
  pointerEvents,
}: {
  dir: keyof typeof DIR;
  colors: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none';
}) {
  return (
    <LinearGradient colors={colors} {...DIR[dir]} style={style} pointerEvents={pointerEvents}>
      {children}
    </LinearGradient>
  );
}
