import aarav from './assets/avatars/aarav.jpg'
import ishita from './assets/avatars/ishita.jpg'
import riya from './assets/avatars/riya.jpg'
import judge from './assets/avatars/judge.jpg'

/* ------------------------------------------------------------------ *
 * Shared, in-memory messaging store.
 * Kept module-level so conversations started during a session (e.g.
 * messaging a competition winner from their profile) persist across
 * navigation between the Messages list and a thread.
 * ------------------------------------------------------------------ */

export type Thread = {
  id: string
  name: string
  avatar: string
  role: 'judge' | 'host' | 'creator'
  context: string
  preview: string
  fromMe: boolean
  time: string
  unread: number
  online: boolean
}

export type Msg = {
  id: number
  fromMe: boolean
  text: string
  time: string
}

export type Conversation = {
  meta: { note: string }
  messages: Msg[]
}

export const threads: Thread[] = [
  {
    id: 'meera',
    name: 'Meera Kulkarni',
    avatar: judge,
    role: 'judge',
    context: 'Judge · Classical Dance',
    preview: 'Loved your footwork in round two — a couple of notes before finals.',
    fromMe: false,
    time: '9:41 AM',
    unread: 2,
    online: true,
  },
  {
    id: 'aarav',
    name: 'Aarav Menon',
    avatar: aarav,
    role: 'host',
    context: 'Host · React UI Challenge',
    preview: 'You: Submitted! Let me know if the repo link works on your end.',
    fromMe: true,
    time: '8:12 AM',
    unread: 0,
    online: true,
  },
  {
    id: 'ishita',
    name: 'Ishita Rao',
    avatar: ishita,
    role: 'judge',
    context: 'Judge · Acoustic Cover Battle',
    preview: 'Your scorecard is ready. Overall a really tight, warm mix.',
    fromMe: false,
    time: 'Yesterday',
    unread: 1,
    online: false,
  },
  {
    id: 'riya',
    name: 'Riya Sharma',
    avatar: riya,
    role: 'creator',
    context: 'Bollywood Freestyle',
    preview: 'You: Haha same, my calves are done for. See you at the meetup?',
    fromMe: true,
    time: 'Tue',
    unread: 0,
    online: false,
  },
]

// Each thread carries its own history so a judge conversation reads like a
// judge conversation and a peer conversation reads casual.
export const conversations: Record<string, Conversation> = {
  meera: {
    meta: { note: 'Judging feedback · Feedants Classical Dance' },
    messages: [
      { id: 1, fromMe: false, text: 'Hi Neha! Congrats on making the finals — your round-two piece really stood out.', time: '9:32 AM' },
      { id: 2, fromMe: true, text: 'Thank you so much! That means a lot coming from you 🙏', time: '9:34 AM' },
      { id: 3, fromMe: false, text: 'Loved your footwork. Two small notes before finals: watch the tempo on the teermanam, and hold the final pose a beat longer.', time: '9:40 AM' },
      { id: 4, fromMe: false, text: 'Judges score the landing more than you’d expect.', time: '9:41 AM' },
    ],
  },
  aarav: {
    meta: { note: 'Host · React UI Challenge' },
    messages: [
      { id: 1, fromMe: false, text: 'Hey! Reviewing entries now. Could you re-check your repo link? It 404’d for me.', time: '8:02 AM' },
      { id: 2, fromMe: true, text: 'Oh no — was set to private. Just flipped it to public.', time: '8:09 AM' },
      { id: 3, fromMe: true, text: 'Submitted! Let me know if the repo link works on your end.', time: '8:12 AM' },
      { id: 4, fromMe: false, text: 'Perfect, opens fine now. Clean commit history too 👏', time: '8:15 AM' },
    ],
  },
  ishita: {
    meta: { note: 'Judging feedback · Acoustic Cover Battle' },
    messages: [
      { id: 1, fromMe: false, text: 'Your scorecard is ready. Overall a really tight, warm mix.', time: 'Yesterday' },
      { id: 2, fromMe: false, text: 'Vocals 9 / Arrangement 8 / Originality 8.5. Only note: the bridge sits a touch quiet.', time: 'Yesterday' },
      { id: 3, fromMe: true, text: 'Appreciate the detail! I’ll push the bridge up for the final round.', time: 'Yesterday' },
    ],
  },
  riya: {
    meta: { note: 'Bollywood Freestyle' },
    messages: [
      { id: 1, fromMe: false, text: 'That rehearsal today was BRUTAL 😂', time: 'Tue' },
      { id: 2, fromMe: true, text: 'Haha same, my calves are done for. See you at the meetup?', time: 'Tue' },
      { id: 3, fromMe: false, text: 'Wouldn’t miss it. Bring the choreo notes!', time: 'Tue' },
    ],
  },
}

// Open (or create) a direct conversation with a competition winner. Returns the
// thread id so the caller can navigate to /messages/:id. The first time it's
// called for a winner it seeds a short, friendly congrats exchange and adds the
// thread to the top of the Messages list.
export function startWinnerConversation(opts: {
  name: string
  avatar: string
  context: string
  wonTitle: string
}): string {
  const id = 'w-' + opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (!conversations[id]) {
    const first = opts.name.split(/\s+/)[0]
    conversations[id] = {
      meta: { note: `New chat · ${opts.context}` },
      messages: [
        {
          id: 1,
          fromMe: true,
          text: `Hey ${first}! Huge congrats on winning ${opts.wonTitle} 🎉 Really well deserved.`,
          time: 'Now',
        },
        {
          id: 2,
          fromMe: false,
          text: 'Thank you so much! 🙏 That means a lot — happy to share tips anytime.',
          time: 'Now',
        },
      ],
    }
  }

  if (!threads.some((t) => t.id === id)) {
    threads.unshift({
      id,
      name: opts.name,
      avatar: opts.avatar,
      role: 'creator',
      context: opts.context,
      preview: 'Thank you so much! 🙏 That means a lot…',
      fromMe: false,
      time: 'Now',
      unread: 0,
      online: true,
    })
  }

  return id
}
