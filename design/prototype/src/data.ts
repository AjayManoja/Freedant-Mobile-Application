import feedantsClassicalDance from './assets/competitions/feedants-classical-dance.jpg'
import acousticCoverBattle from './assets/competitions/acoustic-cover-battle.jpg'
import streetPhotography2026 from './assets/competitions/street-photography-2026.jpg'
import monsoonPoetrySlam from './assets/competitions/monsoon-poetry-slam.jpg'
import sketchOfTheWeek from './assets/competitions/sketch-of-the-week.jpg'
import reactUiChallenge from './assets/competitions/react-ui-challenge.jpg'
import bollywoodFreestyle from './assets/competitions/bollywood-freestyle.jpg'
import indieSongwriting from './assets/competitions/indie-songwriting.jpg'

export type Competition = {
  id: string
  title: string
  tag: string
  host: string
  prize: string
  entry: string
  spots: number
  joined: number
  rating: number
  trending: boolean
  endsIn: string
  img: string
}

const seedCompetitions: Competition[] = [
  {
    id: 'feedants-classical-dance',
    title: 'Feedants Classical Dance',
    tag: 'Dance',
    host: 'Feedants Arts',
    prize: '₹ 1,500',
    entry: '₹ 99',
    spots: 19,
    joined: 421,
    rating: 4.8,
    trending: true,
    endsIn: '1d : 06h',
    img: feedantsClassicalDance,
  },
  {
    id: 'acoustic-cover-battle',
    title: 'Acoustic Cover Battle',
    tag: 'Music',
    host: 'SoundWave',
    prize: '₹ 5,000',
    entry: '₹ 149',
    spots: 8,
    joined: 892,
    rating: 4.9,
    trending: true,
    endsIn: '09h : 22m',
    img: acousticCoverBattle,
  },
  {
    id: 'street-photography-2026',
    title: 'Street Photography 2026',
    tag: 'Photography',
    host: 'LensClub',
    prize: '₹ 3,200',
    entry: '₹ 79',
    spots: 34,
    joined: 256,
    rating: 4.6,
    trending: true,
    endsIn: '2d : 14h',
    img: streetPhotography2026,
  },
  {
    id: 'monsoon-poetry-slam',
    title: 'Monsoon Poetry Slam',
    tag: 'Writing',
    host: 'InkWell',
    prize: '₹ 2,000',
    entry: '₹ 49',
    spots: 12,
    joined: 178,
    rating: 4.5,
    trending: false,
    endsIn: '05h : 12m',
    img: monsoonPoetrySlam,
  },
  {
    id: 'sketch-of-the-week',
    title: 'Sketch of the Week',
    tag: 'Art',
    host: 'Canvas Co.',
    prize: '₹ 800',
    entry: '₹ 29',
    spots: 46,
    joined: 340,
    rating: 4.3,
    trending: false,
    endsIn: '11h : 40m',
    img: sketchOfTheWeek,
  },
  {
    id: 'react-ui-challenge',
    title: 'React UI Challenge',
    tag: 'Coding',
    host: 'DevArena',
    prize: '₹ 7,500',
    entry: '₹ 199',
    spots: 5,
    joined: 1123,
    rating: 5.0,
    trending: true,
    endsIn: '1d : 03h',
    img: reactUiChallenge,
  },
  {
    id: 'bollywood-freestyle',
    title: 'Bollywood Freestyle',
    tag: 'Dance',
    host: 'StepUp',
    prize: '₹ 2,800',
    entry: '₹ 89',
    spots: 22,
    joined: 512,
    rating: 4.7,
    trending: false,
    endsIn: '3d : 08h',
    img: bollywoodFreestyle,
  },
  {
    id: 'indie-songwriting',
    title: 'Indie Songwriting',
    tag: 'Music',
    host: 'SoundWave',
    prize: '₹ 4,000',
    entry: '₹ 129',
    spots: 15,
    joined: 388,
    rating: 4.4,
    trending: false,
    endsIn: '18h : 05m',
    img: indieSongwriting,
  },
]

// ---- Generated fake data --------------------------------------------------
// Procedurally builds a large volume of plausible competitions so every list
// view is fully populated. Deterministic (seeded) so ids/values stay stable
// across renders and reloads.

const GENERATED_COUNT = 240

// Category-specific image pools so every card gets a relevant, varied photo
// (Unsplash) instead of the same handful of assets repeating everywhere.
// Local seed images are mixed in per matching category for extra variety.
const U = 'https://images.unsplash.com/'
const q = '?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=80&w=400&h=400'
const u = (id: string) => `${U}${id}${q}`

const categoryImages: Record<string, string[]> = {
  Dance: [
    feedantsClassicalDance,
    bollywoodFreestyle,
    u('photo-1529229504105-4ea795dcbf59'),
    u('photo-1550026593-cb89847b168d'),
    u('photo-1541904845547-0eaf866de232'),
    u('photo-1508700929628-666bc8bd84ea'),
    u('photo-1621976360623-004223992275'),
    u('photo-1611879531844-24b7ddf40b26'),
  ],
  Music: [
    acousticCoverBattle,
    indieSongwriting,
    u('photo-1565035010268-a3816f98589a'),
    u('photo-1595422656857-ced3a4a0ce25'),
    u('photo-1576967402682-19976eb930f2'),
    u('photo-1526218626217-dc65a29bb444'),
    u('photo-1608319917470-9d9179430f8d'),
    u('photo-1549761505-a31eb21119d6'),
  ],
  Photography: [
    streetPhotography2026,
    u('photo-1551780165-f2a8e6d86eb8'),
    u('photo-1656603020708-e3810e667f97'),
    u('photo-1651866659813-2d6f87dc845a'),
    u('photo-1658249620981-2ee849ea7dc2'),
    u('photo-1651867028939-69e903551276'),
    u('photo-1740265556009-796449091cf8'),
  ],
  Writing: [
    monsoonPoetrySlam,
    u('photo-1617390162404-0545739ceba4'),
    u('photo-1627342725298-231b608b3f1f'),
  ],
  Art: [
    sketchOfTheWeek,
    u('photo-1454191297004-cefa4b1042d8'),
    u('photo-1612641605722-60c66c66530c'),
    u('photo-1569154076682-4c0466623ec2'),
    u('photo-1616898297271-47896b4daaf1'),
    u('photo-1741805190358-aff8c1c1d72a'),
    u('photo-1715634091309-3a7bf0260ce1'),
  ],
  Coding: [
    reactUiChallenge,
    u('photo-1515879218367-8466d910aaa4'),
    u('photo-1555066931-4365d14bab8c'),
    u('photo-1555066931-bf19f8fd1085'),
    u('photo-1621361365424-06f0e1eb5c49'),
    u('photo-1577375729152-4c8b5fcda381'),
    u('photo-1555066932-e78dd8fb77bb'),
  ],
  Cooking: [
    u('photo-1572715376701-98568319fd0b'),
    u('photo-1577219491135-ce391730fb2c'),
    u('photo-1581349485608-9469926a8e5e'),
    u('photo-1577219492769-b63a779fac28'),
    u('photo-1681270543584-8e541a1bb056'),
    u('photo-1595257841889-eca2678454e2'),
  ],
  Gaming: [
    u('photo-1542751371-adc38448a05e'),
    u('photo-1493711662062-fa541adb3fc8'),
    u('photo-1593305841991-05c297ba4575'),
    u('photo-1598550476439-6847785fcea6'),
    u('photo-1552820728-8b83bb6b773f'),
    u('photo-1600861194942-f883de0dfe96'),
  ],
}

const categories: { tag: string; nouns: string[] }[] = [
  { tag: 'Dance', nouns: ['Freestyle', 'Classical Showdown', 'Hip-Hop Cypher', 'Folk Fusion', 'Contemporary Flow'] },
  { tag: 'Music', nouns: ['Cover Battle', 'Beat Making', 'Acoustic Night', 'Rap Clash', 'Melody Marathon'] },
  { tag: 'Photography', nouns: ['Street Frames', 'Portrait Quest', 'Golden Hour', 'Macro Mania', 'Night Lights'] },
  { tag: 'Writing', nouns: ['Poetry Slam', 'Micro Fiction', 'Essay Sprint', 'Story Jam', 'Verse Duel'] },
  { tag: 'Art', nouns: ['Sketch Sprint', 'Doodle Dash', 'Watercolor Week', 'Ink Challenge', 'Portrait Draw'] },
  { tag: 'Coding', nouns: ['UI Challenge', 'Algo Arena', 'Hack Night', 'Bug Hunt', 'Component Craft'] },
  { tag: 'Cooking', nouns: ['Plating Wars', 'Spice Battle', 'Bake Off', 'Street Food Fest', 'Dessert Duel'] },
  { tag: 'Gaming', nouns: ['Clutch Cup', 'Speedrun Sprint', 'Arena Open', 'Ranked Rush', 'Boss Rush'] },
]

const hosts = [
  'Feedants Arts', 'SoundWave', 'LensClub', 'InkWell', 'Canvas Co.',
  'DevArena', 'StepUp', 'Pixel Guild', 'Crescendo', 'Frame House',
  'Verse Union', 'CodeCraft', 'FlavorLab', 'PlayLoop',
]

const prefixes = ['Monsoon', 'Neon', 'Summer', 'Midnight', 'Urban', 'Golden', 'Rising', 'Prime', 'Studio', 'Open', 'Grand', 'Weekend']

// Small seeded PRNG (mulberry32) for deterministic output.
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = makeRng(20260926)
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]
const between = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const inr = (n: number) => '₹ ' + n.toLocaleString('en-IN')

function makeEndsIn(): string {
  const kind = rng()
  if (kind < 0.35) return `0${between(1, 9)}h : ${between(10, 59)}m`
  if (kind < 0.7) return `${between(1, 9)}d : ${String(between(0, 23)).padStart(2, '0')}h`
  return `${String(between(10, 23)).padStart(2, '0')}h : ${String(between(10, 59)).padStart(2, '0')}m`
}

// Per-category cursor so each category cycles through its whole image pool,
// guaranteeing no repeat until the pool is exhausted.
const imgCursor = new Map<string, number>()
const nextCategoryImage = (tag: string) => {
  const pool = categoryImages[tag] ?? [feedantsClassicalDance]
  const n = imgCursor.get(tag) ?? 0
  imgCursor.set(tag, n + 1)
  return pool[n % pool.length]
}

const generatedCompetitions: Competition[] = Array.from({ length: GENERATED_COUNT }, (_, i) => {
  const cat = pick(categories)
  const title = `${pick(prefixes)} ${pick(cat.nouns)}`
  const prize = between(4, 200) * 250
  const entry = pick([29, 39, 49, 59, 79, 89, 99, 129, 149, 199, 249])
  return {
    id: `gen-${i + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    tag: cat.tag,
    host: pick(hosts),
    prize: inr(prize),
    entry: inr(entry),
    spots: between(2, 80),
    joined: between(20, 5000),
    rating: Math.round((3.6 + rng() * 1.4) * 10) / 10,
    trending: rng() < 0.28,
    endsIn: makeEndsIn(),
    img: nextCategoryImage(cat.tag),
  }
})

export const competitions: Competition[] = [...seedCompetitions, ...generatedCompetitions]

export type Upcoming = {
  id: string
  title: string
  tag: string
  starts: string
  entry: string
  prize: string
}

const seedUpcoming: Upcoming[] = [
  {
    id: 'little-sketchers-contest',
    title: 'Little Sketchers Contest',
    tag: 'Kids',
    starts: '5 Oct 26',
    entry: '₹ 39',
    prize: '₹ 1,000',
  },
  {
    id: 'monsoon-frames',
    title: 'Monsoon Frames',
    tag: 'Photography',
    starts: '12 Oct 26',
    entry: '₹ 59',
    prize: '₹ 2,500',
  },
  {
    id: 'hindi-kavya-slam',
    title: 'Hindi Kavya Slam',
    tag: 'Poetry',
    starts: '18 Oct 26',
    entry: '₹ 49',
    prize: '₹ 1,200',
  },
]

const months = ['Oct', 'Nov', 'Dec']
const generatedUpcoming: Upcoming[] = Array.from({ length: 60 }, (_, i) => {
  const cat = pick(categories)
  const title = `${pick(prefixes)} ${pick(cat.nouns)}`
  return {
    id: `gen-up-${i + 1}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    tag: cat.tag,
    starts: `${between(1, 28)} ${pick(months)} 26`,
    entry: inr(pick([29, 39, 49, 59, 79, 99, 149])),
    prize: inr(between(4, 60) * 250),
  }
})

export const upcoming: Upcoming[] = [...seedUpcoming, ...generatedUpcoming]

export const trendingList = competitions.filter((c) => c.trending)
export const endingSoonList = competitions.filter((c) => c.endsIn.startsWith('0'))

export function getCompetition(id?: string): Competition {
  return competitions.find((c) => c.id === id) ?? competitions[0]
}

// ---- Per-competition detail -----------------------------------------------
// Everything on the detail page (judge, winners, reward split, dates, copy)
// is derived deterministically from the competition itself, so each contest
// shows its own consistent data — prize money splits sum to the real prize
// pool, seats left match, and reloads stay stable.

export type Judge = { name: string; title: string; experience: string; avatar: string }
export type Winner = { name: string; place: string; prize: string; avatar: string }

// Deterministic, unique avatar per person derived from their name, so the
// image always matches the identity shown (no repeated/mismatched photos).
export function personAvatar(name: string, style = 'avataaars'): string {
  const seed = encodeURIComponent(name.trim())
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=e8f5f1,c7ece4,d1f0e8&radius=50`
}
export type Reward = { pos: string; amt: number; icon: 'trophy' | 'medal' | 'star' }
export type ImportantDate = { label: string; date: string; time: string }

export type CompetitionDetail = {
  judge: Judge
  winners: Winner[]
  rewards: Reward[]
  dates: ImportantDate[]
  about: string[]
  judging: string[]
  rules: string[]
  aboutHi: string[]
  judgingHi: string[]
  rulesHi: string[]
  winnerCount: number
}

const judgesByCategory: Record<string, Omit<Judge, 'avatar'>[]> = {
  Dance: [
    { name: 'Manju Dubey', title: 'Professional Kathak Dancer', experience: '12+ Years of Experience' },
    { name: 'Rohan Kapoor', title: 'Contemporary Choreographer', experience: '9+ Years of Experience' },
    { name: 'Anaya Rao', title: 'Bharatanatyam Exponent', experience: '15+ Years of Experience' },
  ],
  Music: [
    { name: 'Vikram Nair', title: 'Music Producer & Vocalist', experience: '14+ Years of Experience' },
    { name: 'Sara Khan', title: 'Playback Singer', experience: '10+ Years of Experience' },
    { name: 'Dev Malhotra', title: 'Sound Engineer', experience: '11+ Years of Experience' },
  ],
  Photography: [
    { name: 'Kabir Sen', title: 'Award-winning Photojournalist', experience: '16+ Years of Experience' },
    { name: 'Meera Iyer', title: 'Fine-art Photographer', experience: '8+ Years of Experience' },
  ],
  Writing: [
    { name: 'Aditi Bose', title: 'Published Poet & Editor', experience: '13+ Years of Experience' },
    { name: 'Farhan Ali', title: 'Novelist & Columnist', experience: '10+ Years of Experience' },
  ],
  Art: [
    { name: 'Nikhil Rao', title: 'Illustrator & Muralist', experience: '11+ Years of Experience' },
    { name: 'Tara Menon', title: 'Watercolour Artist', experience: '9+ Years of Experience' },
  ],
  Coding: [
    { name: 'Arjun Pillai', title: 'Principal Frontend Engineer', experience: '12+ Years of Experience' },
    { name: 'Zoya Sheikh', title: 'Staff Engineer & Judge', experience: '10+ Years of Experience' },
  ],
  Cooking: [
    { name: 'Chef Ramesh', title: 'Executive Chef', experience: '18+ Years of Experience' },
    { name: ' Layla Dsouza', title: 'Pastry Chef', experience: '9+ Years of Experience' },
  ],
  Gaming: [
    { name: 'Aryan Gupta', title: 'Pro Esports Coach', experience: '8+ Years of Experience' },
    { name: 'Ken Tanaka', title: 'Tournament Referee', experience: '10+ Years of Experience' },
  ],
}

const winnerNames = [
  'Riya Shah', 'Aarav Mehta', 'Neha Verma', 'Ishita C', 'Karan Joshi',
  'Priya Nair', 'Rahul Das', 'Sneha Roy', 'Ananya Gupta', 'Vivek Kumar',
  'Tara Singh', 'Dev Patel', 'Meera Jain', 'Sahil Rao', 'Nisha Pillai',
]

const aboutByCategory: Record<string, string[]> = {
  Dance: ['An online dance competition open for all age groups.', 'Perform from anywhere and showcase your talent.', 'Express your passion through movement.'],
  Music: ['An online music competition for singers and instrumentalists.', 'Record and submit your best performance from home.', 'Let your sound reach a national audience.'],
  Photography: ['A photography contest capturing everyday moments.', 'Submit your sharpest, most creative frames.', 'Open to phone and DSLR shooters alike.'],
  Writing: ['A writing contest celebrating original voices.', 'Submit your finest poem or short piece.', 'Share stories that move people.'],
  Art: ['An art competition for sketches and illustrations.', 'Submit original hand-drawn or digital artwork.', 'Show the world your creative style.'],
  Coding: ['A coding challenge to build and ship real work.', 'Submit your project repository and demo.', 'Compete with developers across the country.'],
  Cooking: ['A cooking contest plating your signature dish.', 'Submit a video of your recipe and technique.', 'Impress the judges with flavour and craft.'],
  Gaming: ['An esports competition streamed live.', 'Climb the bracket and prove your skill.', 'Open to solo and squad entries.'],
}

const judgingByCategory: Record<string, string[]> = {
  Dance: ['Grace, rhythm and expression carry the highest weightage.', 'Costume and stage presence are considered.', 'Adherence to the chosen form is essential.'],
  Music: ['Pitch, tone and timing are judged closely.', 'Originality of arrangement is rewarded.', 'Audio clarity matters for submissions.'],
  Photography: ['Composition and storytelling are prioritised.', 'Lighting and technical quality are assessed.', 'Minimal editing keeps entries authentic.'],
  Writing: ['Originality and emotional impact are key.', 'Structure and language are evaluated.', 'Adherence to the theme is required.'],
  Art: ['Creativity and execution are weighted highest.', 'Use of colour and detail is assessed.', 'Original work only — no tracing.'],
  Coding: ['Functionality and code quality are judged.', 'UX polish and accessibility earn points.', 'Originality of the solution matters.'],
  Cooking: ['Taste, plating and technique are scored.', 'Creativity of the recipe is rewarded.', 'Hygiene and presentation are considered.'],
  Gaming: ['Ranking is by match performance and score.', 'Fair play and sportsmanship are required.', 'Consistency across rounds is key.'],
}

const rulesGeneric = [
  'One submission per participant is allowed.',
  'Entries must be created within the last 6 months.',
  'Any form of plagiarism leads to disqualification.',
]

// ---- Hindi (हिंदी) content -------------------------------------------------
// Hindi translations of the descriptive copy so the ENG/हिंदी toggle on the
// competition page actually switches the page's language.

const aboutByCategoryHi: Record<string, string[]> = {
  Dance: ['सभी आयु वर्ग के लिए खुली एक ऑनलाइन डांस प्रतियोगिता।', 'कहीं से भी परफ़ॉर्म करें और अपनी प्रतिभा दिखाएँ।', 'नृत्य के ज़रिए अपने जुनून को व्यक्त करें।'],
  Music: ['गायकों और वादकों के लिए एक ऑनलाइन संगीत प्रतियोगिता।', 'घर बैठे अपना बेहतरीन प्रदर्शन रिकॉर्ड करके भेजें।', 'अपनी आवाज़ को पूरे देश तक पहुँचाएँ।'],
  Photography: ['रोज़मर्रा के पलों को कैद करने वाली फोटोग्राफी प्रतियोगिता।', 'अपनी सबसे शानदार और रचनात्मक तस्वीरें भेजें।', 'फ़ोन और DSLR दोनों फ़ोटोग्राफ़रों के लिए खुली।'],
  Writing: ['मौलिक आवाज़ों का जश्न मनाती एक लेखन प्रतियोगिता।', 'अपनी बेहतरीन कविता या रचना भेजें।', 'ऐसी कहानियाँ साझा करें जो दिल छू लें।'],
  Art: ['स्केच और चित्रों के लिए एक कला प्रतियोगिता।', 'मौलिक हस्तनिर्मित या डिजिटल कलाकृति भेजें।', 'दुनिया को अपनी रचनात्मक शैली दिखाएँ।'],
  Coding: ['असली प्रोजेक्ट बनाने की एक कोडिंग चुनौती।', 'अपना प्रोजेक्ट रिपॉज़िटरी और डेमो भेजें।', 'पूरे देश के डेवलपर्स के साथ मुक़ाबला करें।'],
  Cooking: ['अपनी सिग्नेचर डिश सजाने वाली कुकिंग प्रतियोगिता।', 'अपनी रेसिपी और तकनीक का वीडियो भेजें।', 'स्वाद और कारीगरी से जजों को प्रभावित करें।'],
  Gaming: ['लाइव स्ट्रीम होने वाली एक ईस्पोर्ट्स प्रतियोगिता।', 'ब्रैकेट में ऊपर चढ़ें और अपना कौशल साबित करें।', 'सोलो और स्क्वाड दोनों एंट्री के लिए खुली।'],
}

const judgingByCategoryHi: Record<string, string[]> = {
  Dance: ['लय, भाव और अभिव्यक्ति को सबसे अधिक महत्व दिया जाता है।', 'वेशभूषा और मंच उपस्थिति पर भी ध्यान दिया जाता है।', 'चुनी हुई शैली का पालन ज़रूरी है।'],
  Music: ['सुर, स्वर और ताल को बारीकी से आँका जाता है।', 'व्यवस्था की मौलिकता को पुरस्कृत किया जाता है।', 'ऑडियो की स्पष्टता मायने रखती है।'],
  Photography: ['कंपोज़िशन और कहानी कहने को प्राथमिकता दी जाती है।', 'रोशनी और तकनीकी गुणवत्ता का आकलन होता है।', 'कम एडिटिंग एंट्री को प्रामाणिक रखती है।'],
  Writing: ['मौलिकता और भावनात्मक प्रभाव मुख्य हैं।', 'संरचना और भाषा का मूल्यांकन किया जाता है।', 'विषय का पालन आवश्यक है।'],
  Art: ['रचनात्मकता और निष्पादन को सबसे अधिक महत्व मिलता है।', 'रंगों और बारीकी के उपयोग का आकलन होता है।', 'केवल मौलिक कार्य — कोई नक़ल नहीं।'],
  Coding: ['कार्यक्षमता और कोड की गुणवत्ता आँकी जाती है।', 'UX और सुगम्यता पर अंक मिलते हैं।', 'समाधान की मौलिकता मायने रखती है।'],
  Cooking: ['स्वाद, प्लेटिंग और तकनीक को अंक दिए जाते हैं।', 'रेसिपी की रचनात्मकता पुरस्कृत होती है।', 'स्वच्छता और प्रस्तुति पर ध्यान दिया जाता है।'],
  Gaming: ['रैंकिंग मैच प्रदर्शन और स्कोर के आधार पर होती है।', 'निष्पक्ष खेल और खेल भावना आवश्यक है।', 'हर राउंड में निरंतरता महत्वपूर्ण है।'],
}

const rulesGenericHi = [
  'प्रति प्रतिभागी केवल एक प्रविष्टि की अनुमति है।',
  'प्रविष्टियाँ पिछले 6 महीनों में बनाई गई होनी चाहिए।',
  'किसी भी प्रकार की नक़ल पर अयोग्य घोषित कर दिया जाएगा।',
]

function hashString(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function parseMoney(s: string) {
  return Number(s.replace(/[^0-9]/g, '')) || 0
}

// Reward weights per number of winners; each set sums to 1.
const rewardWeights: Record<number, number[]> = {
  3: [0.5, 0.3, 0.2],
  4: [0.4, 0.26, 0.19, 0.15],
  5: [0.36, 0.24, 0.18, 0.13, 0.09],
  6: [0.32, 0.22, 0.17, 0.13, 0.09, 0.07],
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ---- Winner public profile ------------------------------------------------
// A full, deep-linkable profile derived deterministically from a person's name
// (plus the competition they're associated with, when known). Powers the
// dedicated winner profile page reached by tapping a winner anywhere in the app.

export type WinnerAchievement = {
  compId: string
  title: string
  tag: string
  place: string
  prize: string
  img: string
  date: string
}

export type WinnerProfile = {
  name: string
  handle: string
  city: string
  bio: string
  avatar: string
  cover: string
  wins: number
  entries: number
  followers: number
  followersLabel: string
  rating: string
  memberSince: string
  topTag: string
  achievements: WinnerAchievement[]
}

const winnerCities = ['Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Chennai', 'Jaipur', 'Kolkata', 'Hyderabad']
const winnerBios = [
  'Chasing the next stage. Creating every single day.',
  'Self-taught creator · turning practice into podium finishes.',
  'Here to compete, learn and lift others up.',
  'Passionate performer. Multiple-time Feedants finalist.',
  'Small-town dreamer, national-level competitor.',
  'Making art that speaks louder than words.',
]

const fmtFollowers = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`

const winnerProfileCache = new Map<string, WinnerProfile>()

export function getWinnerProfile(name: string, fromCompId?: string): WinnerProfile {
  const key = `${name}::${fromCompId ?? ''}`
  const cached = winnerProfileCache.get(key)
  if (cached) return cached

  const h = hashString(name)
  const wins = 3 + (h % 9)
  const entries = wins + 4 + (h % 12)
  const followers = 240 + (h % 4200)
  const rating = (4 + (h % 10) / 10).toFixed(1)
  const city = winnerCities[h % winnerCities.length]
  const bio = winnerBios[h % winnerBios.length]

  // Build a plausible trophy case. Always lead with the competition the user
  // came from (so it's consistent with what they tapped), then fill with other
  // contests deterministically.
  const from = fromCompId ? competitions.find((c) => c.id === fromCompId) : undefined
  const others = competitions.filter((c) => c.id !== fromCompId)
  const chosen: Competition[] = []
  if (from) chosen.push(from)
  for (let i = 0; chosen.length < Math.min(wins, 5); i++) {
    chosen.push(others[(h + i * 7) % others.length])
  }

  const places = ['1st Winner', '2nd Winner', '3rd Winner', 'Finalist', 'Top 10']
  const achievements: WinnerAchievement[] = chosen.map((c, i) => {
    const det = getCompetitionDetail(c)
    const prize =
      i < det.winners.length ? det.winners[i].prize : det.winners[det.winners.length - 1].prize
    const yr = 24 + ((h + i) % 3)
    const mo = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'][(h + i) % 6]
    return {
      compId: c.id,
      title: c.title,
      tag: c.tag,
      place: i === 0 && from ? '1st Winner' : places[(h + i) % places.length],
      prize,
      img: c.img,
      date: `${mo} '${yr}`,
    }
  })

  const topTag = from?.tag ?? achievements[0]?.tag ?? 'Dance'
  const memberSince = `20${20 + (h % 6)}`

  const profile: WinnerProfile = {
    name,
    handle: name.toLowerCase().replace(/[^a-z0-9]/g, '') + (h % 90 + 10),
    city,
    bio,
    avatar: personAvatar(name),
    cover: from?.img ?? achievements[0]?.img ?? feedantsClassicalDance,
    wins,
    entries,
    followers,
    followersLabel: fmtFollowers(followers),
    rating,
    memberSince,
    topTag,
    achievements,
  }
  winnerProfileCache.set(key, profile)
  return profile
}

// Cache for per-competition detail (declared here so eager exports below that
// call getCompetitionDetail during module init don't hit the TDZ).
const detailCache = new Map<string, CompetitionDetail>()

// ---- My submissions (participant) -----------------------------------------
// The signed-in user's entries across competitions, with a realistic mix of
// statuses. Derived deterministically from the seed competitions so the same
// contests, prizes and thumbnails line up with the rest of the app.

export type SubmissionStatus = 'In review' | 'Judged' | 'Won' | 'Not selected'
export type SubmissionKind = 'Video' | 'Photo' | 'Audio' | 'Writing' | 'Link'

export type Submission = {
  comp: Competition
  status: SubmissionStatus
  kind: SubmissionKind
  submittedOn: string
  place?: string // e.g. "2nd Winner" for won entries
  prize?: string // amount won
}

const kindByTag: Record<string, SubmissionKind> = {
  Dance: 'Video',
  Music: 'Audio',
  Photography: 'Photo',
  Writing: 'Writing',
  Art: 'Photo',
  Coding: 'Link',
  Cooking: 'Video',
  Gaming: 'Video',
}

// A hand-picked set of the user's entries, ordered newest → oldest.
const submissionPlan: {
  id: string
  status: SubmissionStatus
  submittedOn: string
  place?: number
}[] = [
  { id: 'acoustic-cover-battle', status: 'In review', submittedOn: 'Today, 9:14 AM' },
  { id: 'react-ui-challenge', status: 'In review', submittedOn: 'Yesterday, 8:02 PM' },
  { id: 'street-photography-2026', status: 'Judged', submittedOn: '24 Sep 26' },
  { id: 'feedants-classical-dance', status: 'Won', submittedOn: '18 Sep 26', place: 2 },
  { id: 'monsoon-poetry-slam', status: 'Won', submittedOn: '2 Sep 26', place: 1 },
  { id: 'bollywood-freestyle', status: 'Not selected', submittedOn: '21 Aug 26' },
  { id: 'sketch-of-the-week', status: 'Judged', submittedOn: '12 Aug 26' },
  { id: 'indie-songwriting', status: 'Not selected', submittedOn: '30 Jul 26' },
]

export const mySubmissions: Submission[] = submissionPlan.map((p) => {
  const comp = getCompetition(p.id)
  const detail = getCompetitionDetail(comp)
  const winner = p.place != null ? detail.winners[p.place - 1] : undefined
  return {
    comp,
    status: p.status,
    kind: kindByTag[comp.tag] ?? 'Link',
    submittedOn: p.submittedOn,
    place: winner?.place,
    prize: winner?.prize,
  }
})

// ---- My competitions (host dashboard) -------------------------------------
// Competitions the signed-in user hosts, with lifecycle status and live stats.

export type HostStatus = 'Live' | 'Judging' | 'Draft' | 'Closed'

export type HostedCompetition = {
  comp: Competition
  status: HostStatus
  entries: number
  views: number
  revenue: string // entry-fee revenue collected
  createdOn: string
}

export type Entrant = {
  id: string
  name: string
  handle: string
  avatar: string
  submittedOn: string
  kind: SubmissionKind
  rating: number // judging score out of 5
}

const hostPlan: { id: string; status: HostStatus; createdOn: string }[] = [
  { id: 'monsoon-poetry-slam', status: 'Live', createdOn: '20 Sep 26' },
  { id: 'sketch-of-the-week', status: 'Live', createdOn: '14 Sep 26' },
  { id: 'react-ui-challenge', status: 'Judging', createdOn: '28 Aug 26' },
  { id: 'street-photography-2026', status: 'Draft', createdOn: '26 Sep 26' },
  { id: 'bollywood-freestyle', status: 'Closed', createdOn: '2 Aug 26' },
]

export const hostedCompetitions: HostedCompetition[] = hostPlan.map((p) => {
  const comp = getCompetition(p.id)
  const h = hashString('host-' + comp.id)
  const entries = p.status === 'Draft' ? 0 : 20 + (h % Math.max(comp.joined, 40))
  const feeNum = parseMoney(comp.entry)
  return {
    comp,
    status: p.status,
    entries,
    views: entries * (6 + (h % 9)),
    revenue: '₹ ' + (entries * feeNum).toLocaleString('en-IN'),
    createdOn: p.createdOn,
  }
})

const entrantNames = [
  'Aarav Mehta', 'Diya Kapoor', 'Kabir Reddy', 'Anaya Rao', 'Vivaan Shah',
  'Myra Nair', 'Reyansh Das', 'Saanvi Iyer', 'Aditya Joshi', 'Ira Menon',
  'Arjun Pillai', 'Kiara Sen', 'Rohan Gupta', 'Aisha Khan', 'Vihaan Roy',
  'Navya Jain', 'Dev Malhotra', 'Zara Sheikh', 'Ishaan Bose', 'Tara Singh',
]

const entrantsCache = new Map<string, Entrant[]>()

export function getEntrants(hc: HostedCompetition): Entrant[] {
  const cached = entrantsCache.get(hc.comp.id)
  if (cached) return cached
  const h = hashString('ent-' + hc.comp.id)
  const count = Math.min(hc.entries, 12)
  const kind = kindByTag[hc.comp.tag] ?? 'Link'
  const list: Entrant[] = Array.from({ length: count }, (_, i) => {
    const name = entrantNames[(h + i * 3) % entrantNames.length]
    const day = 1 + ((h + i * 5) % 26)
    return {
      id: `${hc.comp.id}-e${i}`,
      name,
      handle: name.toLowerCase().replace(/[^a-z0-9]/g, '.') ,
      avatar: personAvatar(name),
      submittedOn: `${day} Sep 26`,
      kind,
      rating: Math.round((3.4 + ((h + i * 7) % 16) / 10) * 10) / 10,
    }
  })
  // Highest-rated first so hosts see standouts at the top.
  list.sort((a, b) => b.rating - a.rating)
  entrantsCache.set(hc.comp.id, list)
  return list
}

// ---- Leaderboard / live standings -----------------------------------------
// A ranked table of every entrant in a competition, derived deterministically
// from the competition so the same people, scores and order stay stable across
// renders. Powers both the live-standings view (contest still running) and the
// final-results view (contest closed → top N become prize winners).

export type LeaderboardEntry = {
  rank: number
  name: string
  handle: string
  avatar: string
  kind: SubmissionKind
  score: number // judge/community score, 0–100
  votes: number // community votes
  delta: number // rank movement since last refresh (+up / -down / 0)
  isYou: boolean
  place?: string // "1st Winner" etc. (final results only)
  prize?: string // amount won (final results only)
}

const leaderboardCache = new Map<string, LeaderboardEntry[]>()

// The signed-in user's display identity, reused so "You" appears consistently.
const YOU_NAME = 'Neha Sharma'

export function getLeaderboard(comp: Competition): LeaderboardEntry[] {
  const cached = leaderboardCache.get(comp.id)
  if (cached) return cached

  const h = hashString('lb-' + comp.id)
  const detail = getCompetitionDetail(comp)
  const kind = kindByTag[comp.tag] ?? 'Link'
  const size = Math.max(8, Math.min(comp.joined, 40))

  // Build a pool of unique-ish names, injecting the signed-in user somewhere in
  // the upper-middle of the pack so their row is always worth finding.
  const youIndex = 3 + (h % 5)
  const rows: LeaderboardEntry[] = Array.from({ length: size }, (_, i) => {
    const isYou = i === youIndex
    const name = isYou
      ? YOU_NAME
      : entrantNames[(h + i * 3) % entrantNames.length]
    // Scores fan out from ~97 at the top down to the low 60s, with small
    // deterministic jitter so ties and near-ties feel real.
    const base = 97 - i * (34 / size)
    const jitter = ((h + i * 13) % 7) - 3
    const score = Math.max(58, Math.round(base + jitter))
    return {
      rank: i + 1,
      name,
      handle: name.toLowerCase().replace(/[^a-z0-9]/g, '.'),
      avatar: personAvatar(name),
      kind,
      score,
      votes: 40 + ((h + i * 29) % 960),
      delta: ((h + i * 17) % 5) - 2,
      isYou,
    }
  })

  // Sort by score desc so ranks are truthful, then re-number.
  rows.sort((a, b) => b.score - a.score || b.votes - a.votes)
  rows.forEach((r, i) => (r.rank = i + 1))

  // Attach prizes to the top finishers, mirroring the reward split.
  detail.winners.forEach((w, i) => {
    if (rows[i]) {
      rows[i].place = w.place
      rows[i].prize = w.prize
    }
  })

  leaderboardCache.set(comp.id, rows)
  return rows
}

export function getCompetitionDetail(comp: Competition): CompetitionDetail {
  const cached = detailCache.get(comp.id)
  if (cached) return cached

  const h = hashString(comp.id)
  const pool = parseMoney(comp.prize)

  // More winners for bigger prize pools.
  const winnerCount = pool >= 6000 ? 6 : pool >= 3000 ? 5 : pool >= 1200 ? 4 : 3

  const weights = rewardWeights[winnerCount]
  const rawAmts = weights.map((w) => Math.round((pool * w) / 10) * 10)
  // Reconcile rounding so the split sums exactly to the prize pool.
  const drift = pool - rawAmts.reduce((s, a) => s + a, 0)
  rawAmts[0] += drift

  const rewards: Reward[] = rawAmts.map((amt, i) => ({
    pos: `${ordinal(i + 1)} Winner`,
    amt,
    icon: i === 0 ? 'trophy' : i < 3 ? 'medal' : 'star',
  }))

  const winners: Winner[] = rawAmts.map((amt, i) => ({
    name: winnerNames[(h + i) % winnerNames.length],
    place: `${ordinal(i + 1)} Winner`,
    prize: '₹ ' + amt.toLocaleString('en-IN'),
    avatar: personAvatar(winnerNames[(h + i) % winnerNames.length]),
  }))

  const judgePool = judgesByCategory[comp.tag] ?? judgesByCategory.Dance
  const judgeBase = judgePool[h % judgePool.length]
  const judge: Judge = { ...judgeBase, avatar: personAvatar(judgeBase.name) }

  // Deterministic date offsets (in days from a fixed base) per competition.
  const base = new Date(2026, 7, 1) // 1 Aug 2026
  const mk = (offset: number, time: string): ImportantDate => {
    const d = new Date(base)
    d.setDate(d.getDate() + offset)
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    return { label: '', date, time }
  }
  const start = h % 10
  const dates: ImportantDate[] = [
    { ...mk(start + 9, '11:50 PM'), label: 'Register Before' },
    { ...mk(start, '04:00 AM'), label: 'Submission Starts' },
    { ...mk(start + 29, '11:55 PM'), label: 'Submission Ends' },
    { ...mk(start + 31, '11:50 PM'), label: 'Result Date' },
  ]

  const detail: CompetitionDetail = {
    judge,
    winners,
    rewards,
    dates,
    about: aboutByCategory[comp.tag] ?? aboutByCategory.Dance,
    judging: judgingByCategory[comp.tag] ?? judgingByCategory.Dance,
    rules: rulesGeneric,
    aboutHi: aboutByCategoryHi[comp.tag] ?? aboutByCategoryHi.Dance,
    judgingHi: judgingByCategoryHi[comp.tag] ?? judgingByCategoryHi.Dance,
    rulesHi: rulesGenericHi,
    winnerCount,
  }
  detailCache.set(comp.id, detail)
  return detail
}
