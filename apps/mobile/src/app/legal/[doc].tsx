import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PageHeader } from '@/design/components';
import { T } from '@/design/text';
import tw from '@/design/tw';

type Section = { heading: string; body: string[] };
type Doc = { title: string; intro: string; sections: Section[] };

/** When the wording below last changed (shown as "Last updated"). */
const UPDATED = 'October 2, 2026';

/** Terms and Privacy — design/prototype/src/pages/LegalPage.tsx (LegalDoc). */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const { t } = useTranslation();
  const d = t(`legal.docs.${doc === 'privacy' ? 'privacy' : 'terms'}`, { returnObjects: true }) as Doc;
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<number[]>([]);
  const [active, setActive] = useState<number | null>(null);

  const jump = (i: number) => {
    setActive(i);
    scroll.current?.scrollTo({ y: Math.max(0, (offsets.current[i] ?? 0) - 8), animated: true });
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-canvas`} edges={['top']}>
      <View style={tw`flex-1 w-full max-w-[430px] self-center`}>
        <PageHeader subtitle={t('legal.eyebrow')} title={d.title} />
        <ScrollView
          ref={scroll}
          contentContainerStyle={tw`px-4 pb-16 gap-5`}
          showsVerticalScrollIndicator={false}
        >
          <T style={tw`text-[11px] text-slate px-1`}>{t('legal.updated', { date: UPDATED })}</T>

          <T style={tw`text-sm text-slate leading-relaxed rounded-2xl bg-white shadow-sm p-4`}>{d.intro}</T>

          {/* Section index */}
          <View style={tw`rounded-2xl bg-mint p-3`} accessibilityRole="menu">
            <T style={[tw`text-[11px] font-bold uppercase text-teal px-1 mb-1.5`, { letterSpacing: 0.275 }]}>
              {t('legal.onThisPage')}
            </T>
            {d.sections.map((s, i) => (
              <Pressable
                key={s.heading}
                onPress={() => jump(i)}
                accessibilityRole="link"
                style={tw`flex-row items-center gap-2.5 rounded-lg px-2 py-1.5`}
              >
                <T style={tw`w-5 text-xs font-bold text-teal`}>{String(i + 1).padStart(2, '0')}</T>
                <T style={tw`flex-1 text-sm font-semibold ${active === i ? 'text-teal' : 'text-ink'}`}>
                  {s.heading}
                </T>
              </Pressable>
            ))}
          </View>

          {d.sections.map((s, i) => (
            <View
              key={s.heading}
              onLayout={(e) => {
                offsets.current[i] = e.nativeEvent.layout.y;
              }}
              style={tw`rounded-2xl bg-white shadow-sm p-4`}
            >
              <T style={tw`text-base font-extrabold text-ink`} accessibilityRole="header">
                <T style={tw`text-teal text-sm`}>{i + 1}. </T>
                {s.heading}
              </T>
              <View style={tw`mt-2 gap-2.5`}>
                {s.body.map((p) => (
                  <T key={p} style={tw`text-sm text-slate leading-relaxed`}>
                    {p}
                  </T>
                ))}
              </View>
            </View>
          ))}

          <T style={tw`text-center text-[11px] text-slate px-6`}>{t('legal.contact')}</T>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
