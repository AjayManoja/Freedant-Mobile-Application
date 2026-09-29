import { createContext, useContext } from 'react';
import { Text, type TextProps, type TextStyle, StyleSheet } from 'react-native';

/** Poppins is bundled one file per weight (UI_TOKENS §2); CSS weights map onto those files. */
const FAMILY: Record<string, string> = {
  '100': 'Poppins_400Regular',
  '200': 'Poppins_400Regular',
  '300': 'Poppins_400Regular',
  '400': 'Poppins_400Regular',
  normal: 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  bold: 'Poppins_700Bold',
  '800': 'Poppins_800ExtraBold',
  '900': 'Poppins_800ExtraBold',
};

/** Tailwind preflight: 16px text on a 1.5 line height, in ink. */
const BASE: TextStyle = { fontFamily: FAMILY['400'], fontSize: 16, lineHeight: 24, color: '#1b2b3a' };

const Nested = createContext(false);

/**
 * Text that behaves like the design's HTML text: it starts from the page defaults, keeps
 * CSS line-height ratios when only the size changes, and nested <T> inherits from its
 * parent the way a <span> does inside a <p>.
 */
export function T({ style, children, ...rest }: TextProps) {
  const nested = useContext(Nested);
  const own = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const out: TextStyle = nested ? { ...own } : { ...BASE, ...own };
  if (!nested && own.fontSize !== undefined && own.lineHeight === undefined) out.lineHeight = own.fontSize * 1.5;
  if (own.fontWeight !== undefined) {
    out.fontFamily = FAMILY[String(own.fontWeight)] ?? BASE.fontFamily;
    delete out.fontWeight; // the family already carries the weight; a second bold would be synthesised
  }
  return (
    <Text {...rest} style={out}>
      <Nested.Provider value>{children}</Nested.Provider>
    </Text>
  );
}
