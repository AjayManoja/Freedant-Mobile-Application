import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Press } from './components';
import { T } from './text';
import tw, { color } from './tw';

type Action = { label: string; onPress: () => void };

/** components/EmptyState.tsx: illustration, headline, one line, up to two actions. */
export function EmptyState({
  illustration,
  title,
  message,
  primary,
  secondary,
  style,
}: {
  illustration: ReactNode;
  title: string;
  message: string;
  primary?: Action;
  secondary?: Action;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[tw`items-center justify-center px-8`, style]}>
      <View style={tw`mb-5`}>{illustration}</View>
      <T style={tw`text-lg font-extrabold text-ink text-center`} accessibilityRole="header">
        {title}
      </T>
      <T style={tw`mt-1.5 max-w-[280px] text-sm leading-relaxed text-slate text-center`}>{message}</T>
      {primary || secondary ? (
        <View style={tw`mt-6 w-full max-w-[280px] gap-2.5`}>
          {primary ? (
            <Press onPress={primary.onPress} style={tw`w-full rounded-xl bg-teal py-3 items-center shadow-sm`}>
              <T style={tw`text-sm font-bold text-white`}>{primary.label}</T>
            </Press>
          ) : null}
          {secondary ? (
            <Press
              onPress={secondary.onPress}
              style={[tw`w-full rounded-xl bg-white py-3 items-center`, { boxShadow: '0 0 0 1px rgba(13,128,116,0.2)' }]}
            >
              <T style={tw`text-sm font-bold text-teal`}>{secondary.label}</T>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The illustrations' shared 132px scene: mint discs behind teal line art. */
function Scene({ children }: { children: ReactNode }) {
  return (
    <View style={tw`h-[132px] w-[132px]`}>
      <View style={[tw`absolute inset-0 bg-mint`, { borderRadius: 36 }]} />
      <View style={[tw`absolute right-3 top-3 h-6 w-6 rounded-full`, { backgroundColor: 'rgba(13,128,116,0.1)' }]} />
      <View style={[tw`absolute bottom-4 left-4 h-3.5 w-3.5 rounded-full`, { backgroundColor: 'rgba(13,128,116,0.15)' }]} />
      <View style={tw`absolute inset-0 items-center justify-center`}>{children}</View>
    </View>
  );
}

const line = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const NoResultsArt = () => (
  <Scene>
    <Svg width={72} height={72} viewBox="0 0 72 72" stroke={color('teal')} {...line}>
      <Circle cx="31" cy="31" r="18" />
      <Path d="M44 44l13 13" />
      <Path d="M25 29h.01M37 29h.01" />
      <Path d="M26 39c1.6-2 3.3-3 5-3s3.4 1 5 3" />
    </Svg>
  </Scene>
);

export const NoNetworkArt = () => (
  <Scene>
    <Svg width={76} height={76} viewBox="0 0 76 76" stroke={color('teal')} {...line}>
      <Path d="M18 34a28 28 0 0140 0" />
      <Path d="M27 43a16 16 0 0122 0" />
      <Path d="M36 52a4 4 0 014 0" />
      <Circle cx="38" cy="58" r="1.4" fill={color('teal')} stroke="none" />
      <Path d="M16 16l44 44" stroke={color('rose-400')} />
    </Svg>
  </Scene>
);

export const NoEntriesArt = () => (
  <Scene>
    <Svg width={74} height={74} viewBox="0 0 74 74" stroke={color('teal')} {...line}>
      <Path d="M14 32l23-11 23 11-23 11-23-11z" />
      <Path d="M14 32v18l23 11 23-11V32" />
      <Path d="M37 43v18" />
      <Path d="M37 20V9M31 14l6-5 6 5" />
    </Svg>
  </Scene>
);
