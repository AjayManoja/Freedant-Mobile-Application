import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireSignIn, useSession } from '@/auth/session';
import { BottomSheet, initials, Press } from './components';
import { Chevron, Home, Megaphone, PathIcon, Plus, Search, Trophy, Upload } from './icons';
import { T } from './text';
import tw, { color } from './tw';

export type Tab = 'index' | 'explore' | 'competitions' | 'profile';

const PATHS: Record<Tab, Href> = { index: '/', explore: '/explore', competitions: '/competitions', profile: '/profile' };

/**
 * components/BottomNav.tsx: fixed over the content with the raised "+" in the middle.
 * The tab bar of the (tabs) group, and rendered directly by the pushed pages that show
 * it in the design (detail, lists, search, wallet…), highlighting the section they belong to.
 */
export function BottomNav({ active, onTab }: { active: Tab | null; onTab?: (tab: Tab) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const go = (tab: Tab) => (onTab ? onTab(tab) : router.navigate(PATHS[tab]));

  return (
    <>
      <View style={[tw`absolute bottom-0 left-0 right-0 items-center`, { pointerEvents: 'box-none' }]}>
        <View
          style={[
            tw`w-full max-w-[430px] bg-white border-t border-neutral-100 flex-row items-end justify-between px-6 pt-2`,
            { paddingBottom: Math.max(16, insets.bottom) },
          ]}
        >
          <NavItem label={t('tabs.home')} active={active === 'index'} onPress={() => go('index')} icon={(c) => <Home color={c} />} />
          <NavItem label={t('tabs.explore')} active={active === 'explore'} onPress={() => go('explore')} icon={(c) => <Search color={c} />} />
          <View style={tw`-mt-6`}>
            <Press
              onPress={() => setCreateOpen(true)}
              accessibilityLabel={t('tabs.create')}
              scale={0.95}
              style={tw`w-12 h-12 rounded-full bg-teal items-center justify-center shadow-lg`}
            >
              <Plus color="#fff" />
            </Press>
          </View>
          <NavItem
            label={t('tabs.competitions')}
            active={active === 'competitions'}
            onPress={() => go('competitions')}
            icon={(c) => <Trophy size={20} color={c} />}
          />
          <NavItem
            label={t('tabs.profile')}
            active={active === 'profile'}
            onPress={() => go('profile')}
            icon={(c) =>
              user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={tw`w-6 h-6 rounded-full`} contentFit="cover" />
              ) : user?.displayName ? (
                <View style={tw`w-6 h-6 rounded-full bg-mint items-center justify-center`}>
                  <T style={tw`text-[9px] font-bold text-teal`}>{initials(user.displayName)}</T>
                </View>
              ) : (
                <PathIcon d="M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0" size={24} color={c} />
              )
            }
          />
        </View>
      </View>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function NavItem({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon: (color: string) => ReactNode }) {
  const c = active ? color('teal') : color('slate');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={tw`items-center gap-1 min-w-11`}
    >
      {icon(c)}
      <T style={[tw`text-[11px]`, { color: c }, active && tw`font-semibold`]}>{label}</T>
    </Pressable>
  );
}

/** BottomNav CreateSheet: host, join, or go to my submissions. */
function CreateSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const actions: { label: string; sub: string; icon: ReactNode; tint: string; to: Href; auth: boolean }[] = [
    { label: t('design.hostAction'), sub: t('design.hostActionSub'), icon: <Megaphone size={20} color={color('teal')} />, tint: 'bg-mint', to: '/host', auth: true },
    { label: t('design.joinAction'), sub: t('design.joinActionSub'), icon: <Search size={20} color={color('indigo-500')} />, tint: 'bg-indigo-50', to: '/explore', auth: false },
    { label: t('design.subsAction'), sub: t('design.subsActionSub'), icon: <Upload color={color('amber-600')} />, tint: 'bg-amber-50', to: '/submissions', auth: true },
  ];
  return (
    <BottomSheet open={open} onClose={onClose}>
      <T style={tw`mt-4 text-lg font-extrabold text-ink`} accessibilityRole="header">
        {t('design.createTitle')}
      </T>
      <T style={tw`text-xs text-slate`}>{t('design.createSub')}</T>
      <View style={tw`mt-4 gap-2.5`}>
        {actions.map((a) => (
          <Press
            key={a.label}
            accessibilityLabel={a.label}
            onPress={() => {
              onClose();
              if (a.auth && !requireSignIn(a.to as string)) return;
              router.push(a.to);
            }}
            style={tw`flex-row w-full items-center gap-3.5 rounded-2xl bg-white p-3.5 shadow-sm`}
          >
            <View style={tw`h-11 w-11 items-center justify-center rounded-xl ${a.tint}`}>{a.icon}</View>
            <View style={tw`min-w-0 flex-1`}>
              <T style={tw`text-sm font-bold text-ink leading-tight`}>{a.label}</T>
              <T style={tw`text-xs text-slate leading-snug`}>{a.sub}</T>
            </View>
            <Chevron color={color('slate')} rotate={-90} />
          </Press>
        ))}
      </View>
    </BottomSheet>
  );
}
