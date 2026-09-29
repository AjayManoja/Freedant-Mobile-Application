import type { ReactElement } from 'react';
import { Camera, Fire, PathIcon, Star, Trophy } from './icons';

const PEN = 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z';

/** HomePage `categories`: the four designed tiles, and the same family for the rest. */
const CATEGORY_STYLE: Record<string, { bg: string; fg: string; icon: (c: string) => ReactElement }> = {
  dance: { bg: 'bg-mint', fg: 'teal', icon: (c) => <Fire size={20} color={c} /> },
  music: { bg: 'bg-amber-50', fg: 'amber-500', icon: (c) => <Star size={20} color={c} /> },
  art: { bg: 'bg-rose-50', fg: 'rose-400', icon: (c) => <Star size={20} color={c} /> },
  coding: { bg: 'bg-indigo-50', fg: 'indigo-400', icon: (c) => <Trophy size={20} color={c} /> },
  photography: { bg: 'bg-sky-50', fg: 'sky-500', icon: (c) => <Camera size={20} color={c} /> },
  writing: { bg: 'bg-violet-50', fg: 'violet-500', icon: (c) => <PathIcon d={PEN} size={20} color={c} /> },
  cooking: { bg: 'bg-orange-50', fg: 'orange-500', icon: (c) => <Fire size={20} color={c} /> },
  gaming: { bg: 'bg-emerald-50', fg: 'emerald-600', icon: (c) => <Trophy size={20} color={c} /> },
};

export const categoryStyle = (slug: string) => CATEGORY_STYLE[slug] ?? CATEGORY_STYLE.dance!;
