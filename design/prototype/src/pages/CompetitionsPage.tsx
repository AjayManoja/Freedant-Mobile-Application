import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { getCompetition, getCompetitionDetail } from '../data'
import { BottomNav } from '../components/BottomNav'
import {
  ArrowLeft,
  CalendarIcon,
  Card,
  Chat,
  CheckCircle,
  Chevron,
  Clock,
  Hourglass,
  Info,
  Megaphone,
  Pill,
  Play,
  PlayBadge,
  Razorpay,
  Send,
  Shield,
  Trophy,
  Upload,
  Users,
} from '../ui'
import type { Competition } from '../data'
// Parse a competition's "endsIn" (e.g. "1d : 06h" or "09h : 22m") into seconds
// so the live countdown starts from the right value for each competition.
function endsInToSeconds(endsIn: string): number {
  let total = 0
  const dm = endsIn.match(/(\d+)\s*d/)
  const hm = endsIn.match(/(\d+)\s*h/)
  const mm = endsIn.match(/(\d+)\s*m/)
  if (dm) total += Number(dm[1]) * 86400
  if (hm) total += Number(hm[1]) * 3600
  if (mm) total += Number(mm[1]) * 60
  return total || 3600
}

type Lang = 'ENG' | 'हिंदी'
type TabKey = 'about' | 'judging' | 'rules'

// Shared stroke styling for the inline SVGs used by the checkout sheet.
const s = {
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
}

// Bilingual UI copy so the ENG / हिंदी toggle switches the whole page, not just
// the descriptive paragraphs.
const STRINGS: Record<Lang, {
  goBack: string
  competition: string
  registered: string
  multiWin: string
  certificate: string
  prizePool: string
  entryFee: string
  spotsLeft: (n: number) => string
  joined: (n: number) => string
  judge: string
  introVideo: string
  regClosesIn: string
  hurry: string
  importantDates: string
  previousWinners: string
  won: string
  viewProfile: string
  tabs: Record<TabKey, string>
  viewMore: string
  viewLess: string
  rewards: string
  topPositions: (n: number) => string
  totalPrizePool: string
  disclaimer: string
  disclaimerBody: string
  prizeQ: string
  watchVideo: string
  refundPolicy: string
  securePayments: string
  referEarn: string
  copyLink: string
  referNow: string
  referHint: string
  hearUsers: string
  hearUsersSub: string
  adHere: string
  uploadSubmission: string
  for: string
  chooseFile: string
  fileHint: string
  orPasteLink: string
  submitEntry: string
  uploading: string
  close: string
  register: (e: string) => string
  spotsLeftShort: (n: number) => string
  referralCopied: string
  loadingTestimonials: string
  submissionUploaded: string
  // Checkout / Razorpay flow
  checkout: string
  orderSummary: string
  entryAmount: string
  platformFee: string
  gst: string
  referralDiscount: string
  totalPayable: string
  payUsing: string
  upi: string
  upiSub: string
  cards: string
  cardsSub: string
  netbanking: string
  netbankingSub: string
  wallets: string
  walletsSub: string
  upiIdLabel: string
  upiIdPlaceholder: string
  verifyPay: string
  cardNumber: string
  nameOnCard: string
  nameOnCardPlaceholder: string
  expiry: string
  cvv: string
  selectBank: string
  selectWallet: string
  payAmount: (e: string) => string
  poweredBy: string
  encrypted: string
  processing: string
  redirecting: string
  paymentSuccess: string
  paidFor: (title: string) => string
  txnId: string
  done: string
  paymentFailed: string
  paymentFailedSub: string
  retry: string
  cancelPayment: string
  offerApplied: string
  leaderboard: string
}> = {
  ENG: {
    goBack: 'Go back',
    competition: 'Competition',
    registered: 'Registered',
    multiWin: 'Multi-Win',
    certificate: 'Winners get certificate',
    prizePool: 'Prize Pool',
    entryFee: 'Entry Fee',
    spotsLeft: (n) => `Only ${n} spots left`,
    joined: (n) => `${n} joined`,
    judge: 'Judge',
    introVideo: 'Intro Video',
    regClosesIn: 'Registration closes in',
    hurry: 'Hurry up!',
    importantDates: 'Important Dates',
    previousWinners: 'Previous Winners',
    leaderboard: 'Leaderboard',
    won: 'Won',
    viewProfile: 'View profile',
    tabs: {
      about: 'About Competition',
      judging: 'Judging Parameters',
      rules: 'Rules & Eligibility',
    },
    viewMore: 'View more',
    viewLess: 'View less',
    rewards: 'Rewards',
    topPositions: (n) => `(Top ${n} Positions)`,
    totalPrizePool: 'Total Prize Pool',
    disclaimer: 'Disclaimer:',
    disclaimerBody:
      'Only contributions from paid participants will be considered for judging.',
    prizeQ: 'How will you receive prize money?',
    watchVideo: 'Watch video to know more',
    refundPolicy: 'Refund policy',
    securePayments: 'Secure payments by',
    referEarn: 'Refer & Earn more discount',
    copyLink: 'Copy Link',
    referNow: 'Refer Now',
    referHint: 'You earn ₹10 for every signup',
    hearUsers: 'Hear From Our Users',
    hearUsersSub: 'See what participants say about feedants',
    adHere: 'Ad Here',
    uploadSubmission: 'Upload Submission',
    for: 'For',
    chooseFile: 'Tap to choose a file',
    fileHint: 'Video, image or PDF · up to 100 MB',
    orPasteLink: 'or paste a link',
    submitEntry: 'Submit entry',
    uploading: 'Uploading…',
    close: 'Close',
    register: (e) => `Register · ${e}`,
    spotsLeftShort: (n) => `${n} spots left`,
    referralCopied: 'Referral link copied',
    loadingTestimonials: 'Loading testimonials…',
    submissionUploaded: 'Submission uploaded 🎉',
    checkout: 'Checkout',
    orderSummary: 'Order summary',
    entryAmount: 'Entry fee',
    platformFee: 'Platform fee',
    gst: 'GST (18%)',
    referralDiscount: 'Referral discount',
    totalPayable: 'Total payable',
    payUsing: 'Pay using',
    upi: 'UPI',
    upiSub: 'GPay, PhonePe, Paytm & more',
    cards: 'Cards',
    cardsSub: 'Visa, Mastercard, RuPay',
    netbanking: 'Netbanking',
    netbankingSub: 'All Indian banks',
    wallets: 'Wallets',
    walletsSub: 'Paytm, Amazon Pay, Mobikwik',
    upiIdLabel: 'Enter UPI ID',
    upiIdPlaceholder: 'yourname@upi',
    verifyPay: 'Verify & pay',
    cardNumber: 'Card number',
    nameOnCard: 'Name on card',
    nameOnCardPlaceholder: 'Neha Sharma',
    expiry: 'MM / YY',
    cvv: 'CVV',
    selectBank: 'Select your bank',
    selectWallet: 'Select a wallet',
    payAmount: (e) => `Pay ${e}`,
    poweredBy: 'Powered by',
    encrypted: '256-bit encrypted · 100% secure',
    processing: 'Processing payment…',
    redirecting: 'Confirming with your bank…',
    paymentSuccess: 'Payment successful',
    paidFor: (title) => `You're registered for ${title}`,
    txnId: 'Transaction ID',
    done: 'Continue',
    paymentFailed: 'Payment failed',
    paymentFailedSub: 'No money was deducted. Please try again.',
    retry: 'Retry payment',
    cancelPayment: 'Cancel',
    offerApplied: 'FEED10 applied',
  },
  हिंदी: {
    goBack: 'वापस जाएँ',
    competition: 'प्रतियोगिता',
    registered: 'रजिस्टर्ड',
    multiWin: 'कई विजेता',
    certificate: 'विजेताओं को प्रमाणपत्र',
    prizePool: 'इनाम राशि',
    entryFee: 'प्रवेश शुल्क',
    spotsLeft: (n) => `केवल ${n} स्थान शेष`,
    joined: (n) => `${n} शामिल हुए`,
    judge: 'निर्णायक',
    introVideo: 'परिचय वीडियो',
    regClosesIn: 'रजिस्ट्रेशन बंद होने में',
    hurry: 'जल्दी करें!',
    importantDates: 'महत्वपूर्ण तिथियाँ',
    previousWinners: 'पिछले विजेता',
    leaderboard: 'लीडरबोर्ड',
    won: 'जीता',
    viewProfile: 'प्रोफ़ाइल देखें',
    tabs: {
      about: 'प्रतियोगिता के बारे में',
      judging: 'निर्णय मापदंड',
      rules: 'नियम और पात्रता',
    },
    viewMore: 'और देखें',
    viewLess: 'कम देखें',
    rewards: 'इनाम',
    topPositions: (n) => `(शीर्ष ${n} स्थान)`,
    totalPrizePool: 'कुल इनाम राशि',
    disclaimer: 'अस्वीकरण:',
    disclaimerBody:
      'निर्णय के लिए केवल भुगतान करने वाले प्रतिभागियों की प्रविष्टियाँ ही मान्य होंगी।',
    prizeQ: 'आपको इनाम राशि कैसे मिलेगी?',
    watchVideo: 'अधिक जानने के लिए वीडियो देखें',
    refundPolicy: 'रिफ़ंड नीति',
    securePayments: 'सुरक्षित भुगतान द्वारा',
    referEarn: 'रेफ़र करें और अधिक छूट पाएँ',
    copyLink: 'लिंक कॉपी करें',
    referNow: 'अभी रेफ़र करें',
    referHint: 'हर साइन-अप पर आप ₹10 कमाते हैं',
    hearUsers: 'हमारे उपयोगकर्ताओं से सुनें',
    hearUsersSub: 'देखें प्रतिभागी feedants के बारे में क्या कहते हैं',
    adHere: 'यहाँ विज्ञापन',
    uploadSubmission: 'प्रविष्टि अपलोड करें',
    for: 'इसके लिए',
    chooseFile: 'फ़ाइल चुनने के लिए टैप करें',
    fileHint: 'वीडियो, इमेज या PDF · अधिकतम 100 MB',
    orPasteLink: 'या लिंक पेस्ट करें',
    submitEntry: 'प्रविष्टि जमा करें',
    uploading: 'अपलोड हो रहा है…',
    close: 'बंद करें',
    register: (e) => `रजिस्टर करें · ${e}`,
    spotsLeftShort: (n) => `${n} स्थान शेष`,
    referralCopied: 'रेफ़रल लिंक कॉपी हो गया',
    loadingTestimonials: 'प्रशंसापत्र लोड हो रहे हैं…',
    submissionUploaded: 'प्रविष्टि अपलोड हो गई 🎉',
    checkout: 'भुगतान',
    orderSummary: 'ऑर्डर सारांश',
    entryAmount: 'प्रवेश शुल्क',
    platformFee: 'प्लेटफ़ॉर्म शुल्क',
    gst: 'जीएसटी (18%)',
    referralDiscount: 'रेफ़रल छूट',
    totalPayable: 'कुल देय राशि',
    payUsing: 'भुगतान का तरीका',
    upi: 'यूपीआई',
    upiSub: 'GPay, PhonePe, Paytm आदि',
    cards: 'कार्ड',
    cardsSub: 'Visa, Mastercard, RuPay',
    netbanking: 'नेटबैंकिंग',
    netbankingSub: 'सभी भारतीय बैंक',
    wallets: 'वॉलेट',
    walletsSub: 'Paytm, Amazon Pay, Mobikwik',
    upiIdLabel: 'यूपीआई आईडी दर्ज करें',
    upiIdPlaceholder: 'yourname@upi',
    verifyPay: 'सत्यापित करें और भुगतान करें',
    cardNumber: 'कार्ड नंबर',
    nameOnCard: 'कार्ड पर नाम',
    nameOnCardPlaceholder: 'नेहा शर्मा',
    expiry: 'MM / YY',
    cvv: 'CVV',
    selectBank: 'अपना बैंक चुनें',
    selectWallet: 'वॉलेट चुनें',
    payAmount: (e) => `${e} भुगतान करें`,
    poweredBy: 'द्वारा संचालित',
    encrypted: '256-बिट एन्क्रिप्टेड · 100% सुरक्षित',
    processing: 'भुगतान प्रोसेस हो रहा है…',
    redirecting: 'आपके बैंक से पुष्टि हो रही है…',
    paymentSuccess: 'भुगतान सफल',
    paidFor: (title) => `आप ${title} के लिए रजिस्टर हो गए`,
    txnId: 'लेनदेन आईडी',
    done: 'आगे बढ़ें',
    paymentFailed: 'भुगतान विफल',
    paymentFailedSub: 'कोई राशि नहीं कटी। कृपया पुनः प्रयास करें।',
    retry: 'पुनः भुगतान करें',
    cancelPayment: 'रद्द करें',
    offerApplied: 'FEED10 लागू',
  },
}

// Localize the position/date labels that are generated (in English) in data.ts.
const DATE_LABELS_HI: Record<string, string> = {
  'Register Before': 'रजिस्टर करने की अंतिम तिथि',
  'Submission Starts': 'सबमिशन प्रारंभ',
  'Submission Ends': 'सबमिशन समाप्त',
  'Result Date': 'परिणाम तिथि',
}
// Hindi for the finite set of judge titles defined in data.ts.
const JUDGE_TITLE_HI: Record<string, string> = {
  'Professional Kathak Dancer': 'पेशेवर कथक नृत्यांगना',
  'Contemporary Choreographer': 'समकालीन नृत्य निर्देशक',
  'Bharatanatyam Exponent': 'भरतनाट्यम विशेषज्ञ',
  'Music Producer & Vocalist': 'संगीत निर्माता और गायक',
  'Playback Singer': 'पार्श्व गायिका',
  'Sound Engineer': 'साउंड इंजीनियर',
  'Award-winning Photojournalist': 'पुरस्कार विजेता फोटो पत्रकार',
  'Fine-art Photographer': 'फाइन-आर्ट फोटोग्राफर',
  'Published Poet & Editor': 'प्रकाशित कवयित्री और संपादक',
  'Novelist & Columnist': 'उपन्यासकार और स्तंभकार',
  'Illustrator & Muralist': 'चित्रकार और म्यूरल कलाकार',
  'Watercolour Artist': 'जल-रंग कलाकार',
  'Principal Frontend Engineer': 'प्रधान फ्रंटएंड इंजीनियर',
  'Staff Engineer & Judge': 'स्टाफ इंजीनियर और निर्णायक',
  'Executive Chef': 'कार्यकारी शेफ',
  'Pastry Chef': 'पेस्ट्री शेफ',
  'Pro Esports Coach': 'पेशेवर ईस्पोर्ट्स कोच',
  'Tournament Referee': 'टूर्नामेंट रेफरी',
}
// "12+ Years of Experience" -> "12+ वर्षों का अनुभव"
function localizeExperience(exp: string, hi: boolean): string {
  if (!hi) return exp
  const m = exp.match(/(\d+\+?)/)
  return m ? `${m[1]} वर्षों का अनुभव` : exp
}

const ORDINAL_HI = ['', 'पहला', 'दूसरा', 'तीसरा', 'चौथा', 'पाँचवाँ', 'छठा', 'सातवाँ']
function localizePlace(pos: string, hi: boolean): string {
  if (!hi) return pos
  const m = pos.match(/^(\d+)(?:st|nd|rd|th)\s*Winner$/)
  if (m) return `${ORDINAL_HI[Number(m[1])] ?? m[1]} विजेता`
  if (pos === 'Finalist') return 'फ़ाइनलिस्ट'
  if (/^Top\s/.test(pos)) return pos.replace('Top', 'शीर्ष')
  return pos
}

function useCountdown(target: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    // Tick once a minute — the display shows days/hours/minutes only, so a
    // per-second interval just made the value flicker constantly.
    const id = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])
  const diff = Math.max(0, target - now)
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d)}d : ${p(h)}h : ${p(m)}m`
}

export default function CompetitionsPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const comp = getCompetition(id)
  const detail = getCompetitionDetail(comp)
  const target = useMemo(
    () => Date.now() + endsInToSeconds(comp.endsIn) * 1000,
    [comp.endsIn],
  )
  const countdown = useCountdown(target)
  const [lang, setLang] = useState<Lang>('ENG')
  const [tab, setTab] = useState<TabKey>('about')
  const [expanded, setExpanded] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const hi = lang === 'हिंदी'
  const t = STRINGS[lang]

  const tabContent: Record<TabKey, string[]> = {
    about: hi ? detail.aboutHi : detail.about,
    judging: hi ? detail.judgingHi : detail.judging,
    rules: hi ? detail.rulesHi : detail.rules,
  }

  // Reset tab/expansion when navigating between competitions.
  useEffect(() => {
    setTab('about')
    setExpanded(false)
    setUploadOpen(false)
    setCheckoutOpen(false)
  }, [comp.id])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  const copyReferral = async () => {
    const link = 'https://feedants.com/r/referral123'
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* clipboard may be blocked; still confirm to the user */
    }
    setToast(t.referralCopied)
  }

  return (
    <>
      <div
        className="flex-1 overflow-y-auto no-scrollbar pb-44"
        data-scroll
      >
        {/* Hero banner */}
        <div className="relative h-44">
          <img
            src={comp.img}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/35 to-canvas" />
          <div className="relative flex items-center justify-between px-5 pt-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white font-bold text-lg drop-shadow"
            >
              <ArrowLeft />
              {t.goBack}
            </button>
            <div className="flex items-center rounded-full bg-white/20 backdrop-blur p-1">
              {(['ENG', 'हिंदी'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${
                    lang === l ? 'bg-white text-teal' : 'text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="relative px-5 mt-4 text-white">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
              <Trophy className="w-3.5 h-3.5" /> {comp.tag} {t.competition}
            </span>
          </div>
        </div>

        <div className="px-4 -mt-6 relative space-y-4">
        {/* Main info card */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[26px] leading-tight font-extrabold text-ink">
              {comp.title}
            </h1>
            {registered && (
              <span className="shrink-0 flex items-center gap-1.5 rounded-full bg-mint text-teal-dark text-xs font-semibold px-3 py-1.5">
                <CheckCircle /> {t.registered}
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Pill>{comp.tag}</Pill>
            <Pill>{t.multiWin}</Pill>
            <span className="flex items-center gap-1 text-teal text-sm font-medium">
              <Trophy className="w-4 h-4" /> {t.certificate}
            </span>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="flex items-end gap-6 shrink-0">
              <div>
                <p className="text-slate text-sm">{t.prizePool}</p>
                <p className="text-2xl font-extrabold text-teal mt-1">
                  {comp.prize}
                </p>
              </div>
              <div>
                <p className="text-slate text-sm">{t.entryFee}</p>
                <p className="text-2xl font-extrabold text-ink mt-1">
                  {comp.entry}
                </p>
              </div>
            </div>
            <div className="flex-1 max-w-[150px]">
              <p className="flex items-center justify-end gap-1.5 text-teal text-sm font-semibold">
                <Users /> {t.spotsLeft(comp.spots)}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-neutral-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal"
                  style={{
                    width: `${Math.min(95, Math.round((comp.joined / (comp.joined + comp.spots)) * 100))}%`,
                  }}
                />
              </div>
              <p className="text-right text-xs text-slate mt-1">
                {t.joined(comp.joined)}
              </p>
            </div>
          </div>
        </Card>

        {/* Judge card */}
        <Card className="flex items-center gap-4">
          <img
            src={detail.judge.avatar}
            alt={`${detail.judge.name}, judge`}
            className="w-16 h-16 rounded-full object-cover bg-mint"
          />
          <div className="flex-1">
            <p className="text-slate text-xs">{t.judge}</p>
            <p className="text-lg font-bold text-ink leading-snug">
              {detail.judge.name}
            </p>
            <p className="text-slate text-xs">
              {hi ? (JUDGE_TITLE_HI[detail.judge.title] ?? detail.judge.title) : detail.judge.title}
            </p>
            <p className="text-slate text-xs">
              {localizeExperience(detail.judge.experience, hi)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button className="w-11 h-11 rounded-full bg-mint flex items-center justify-center text-teal hover:bg-teal hover:text-white transition">
              <Play />
            </button>
            <span className="text-[11px] text-slate">{t.introVideo}</span>
          </div>
        </Card>

        {/* Countdown */}
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-mint px-4 py-3">
          <span className="flex items-center gap-2 text-ink text-sm font-medium">
            <Hourglass /> {t.regClosesIn}
          </span>
          <span className="text-teal font-bold text-sm tabular-nums">
            {countdown}
          </span>
          <span className="flex items-center gap-1 text-teal text-sm font-medium">
            <Clock /> {t.hurry}
          </span>
        </div>

        {/* Important dates */}
        <Card>
          <h2 className="font-bold text-ink mb-3">{t.importantDates}</h2>
          <div className="grid grid-cols-2">
            {detail.dates.map((d, i) => {
              const icon = [
                <CalendarIcon />,
                <Send />,
                <Upload />,
                <Trophy className="w-5 h-5" />,
              ][i]
              const cls = [
                'border-b border-r border-neutral-100 pb-4 pr-4',
                'border-b border-neutral-100 pb-4 pl-4',
                'border-r border-neutral-100 pt-4 pr-4',
                'pt-4 pl-4',
              ][i]
              return (
                <DateCell
                  key={d.label}
                  icon={icon}
                  label={hi ? (DATE_LABELS_HI[d.label] ?? d.label) : d.label}
                  date={d.date}
                  time={d.time}
                  className={cls}
                />
              )
            })}
          </div>
        </Card>

        {/* Previous winners */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-ink">{t.previousWinners}</h2>
            <button
              onClick={() => navigate(`/competitions/${comp.id}/results`)}
              className="flex items-center gap-0.5 text-teal text-xs font-semibold"
            >
              {t.leaderboard}
              <Chevron className="-rotate-90 w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {detail.winners.map((w, i) => (
              <button
                key={`${w.name}-${i}`}
                onClick={() =>
                  navigate(
                    `/winners/${encodeURIComponent(w.name)}?from=${comp.id}`,
                  )
                }
                className="shrink-0 w-[210px] flex items-center gap-2 rounded-xl bg-neutral-50 p-2 text-left active:scale-[0.98] transition"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-mint shrink-0">
                  <img
                    src={w.avatar}
                    alt={w.name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <PlayBadge />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink leading-tight truncate">
                    {w.name}
                  </p>
                  <p className="text-xs text-teal">{localizePlace(w.place, hi)}</p>
                  <p className="text-xs text-slate">{t.won} {w.prize}</p>
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-teal">
                    {t.viewProfile}
                    <Chevron className="-rotate-90 w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Tabs */}
        <Card>
          <div className="flex border-b border-neutral-100 -mx-5 px-5">
            {(Object.keys(tabContent) as TabKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 pb-3 text-sm font-semibold transition relative ${
                  tab === key ? 'text-teal' : 'text-slate'
                }`}
              >
                {t.tabs[key]}
                {tab === key && (
                  <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-teal rounded-full" />
                )}
              </button>
            ))}
          </div>
          <div className="pt-4 space-y-1.5 text-sm text-slate leading-relaxed">
            {(expanded ? tabContent[tab] : tabContent[tab].slice(0, 3)).map(
              (line, i) => (
                <p key={i}>{line}</p>
              ),
            )}
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 flex items-center gap-1 mx-auto text-teal text-sm font-semibold"
          >
            {expanded ? t.viewLess : t.viewMore}
            <Chevron className={expanded ? 'rotate-180' : ''} />
          </button>
        </Card>

        {/* Rewards */}
        <Card>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="font-bold text-ink">{t.rewards}</h2>
            <span className="text-slate text-xs">
              {t.topPositions(detail.winnerCount)}
            </span>
          </div>
          <div className="divide-y divide-neutral-100">
            {detail.rewards.map((r) => (
              <div key={r.pos} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <RewardIcon type={r.icon} />
                  <span className="text-sm font-medium text-ink">{localizePlace(r.pos, hi)}</span>
                </div>
                <span className="text-teal font-bold">
                  ₹ {r.amt.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-sm font-bold text-ink">{t.totalPrizePool}</span>
            <span className="text-teal font-extrabold">{comp.prize}</span>
          </div>
        </Card>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-2xl bg-mint px-4 py-3 text-sm">
          <span className="text-teal mt-0.5 shrink-0">
            <Info />
          </span>
          <p className="text-slate">
            <span className="font-bold text-ink">{t.disclaimer}</span>{' '}
            {t.disclaimerBody}
          </p>
        </div>

        {/* Prize money + refund */}
        <Card className="flex items-center gap-3 p-3.5">
          <div className="flex items-center gap-2.5 shrink-0 pr-3 border-r border-neutral-100 w-[52%]">
            <button className="w-9 h-9 rounded-full bg-teal text-white flex items-center justify-center shrink-0">
              <Play />
            </button>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-ink leading-tight">
                {t.prizeQ}
              </p>
              <p className="text-[10px] text-slate mt-0.5">
                {t.watchVideo}
              </p>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="flex items-center gap-1.5 text-[10px] text-slate">
              <span className="text-teal shrink-0">
                <Shield />
              </span>
              {t.refundPolicy}
            </p>
            <p className="flex items-start gap-1.5 text-[10px] text-slate leading-snug">
              <span className="text-teal shrink-0 mt-0.5">
                <Shield />
              </span>
              <span>
                {t.securePayments} <Razorpay />
              </span>
            </p>
          </div>
        </Card>

        {/* Refer & earn */}
        <div className="rounded-2xl bg-mint p-4 flex items-center gap-3">
          <span className="text-teal shrink-0">
            <Megaphone className="w-7 h-7" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink text-[13px]">
              {t.referEarn}
            </p>
            <div className="mt-2 flex items-center bg-white rounded-lg overflow-hidden border border-white">
              <input
                readOnly
                value="https://feedants.com/r/referral123"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] text-slate outline-none bg-transparent"
              />
              <button
                onClick={copyReferral}
                className="px-3 py-1.5 text-[11px] font-semibold text-teal border-l border-neutral-100 shrink-0"
              >
                {t.copyLink}
              </button>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-center w-[96px]">
            <button
              onClick={() => navigate('/refer')}
              className="w-full rounded-lg bg-teal text-white text-[13px] font-semibold py-2"
            >
              {t.referNow}
            </button>
            <p className="text-[10px] text-slate mt-1.5 text-center leading-tight">
              {t.referHint}
            </p>
          </div>
        </div>

        {/* Hear from users */}
        <button
          onClick={() => setToast(t.loadingTestimonials)}
          className="w-full"
        >
          <Card className="flex items-center gap-3">
            <span className="text-teal">
              <Chat />
            </span>
            <div className="flex-1 text-left">
              <p className="font-bold text-ink text-sm">{t.hearUsers}</p>
              <p className="text-xs text-slate">
                {t.hearUsersSub}
              </p>
            </div>
            <Chevron className="-rotate-90 text-slate" />
          </Card>
        </button>

        {/* Ad slot */}
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 py-4 text-slate text-sm">
          <Megaphone className="w-4 h-4" /> {t.adHere}
        </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="absolute bottom-[68px] left-0 right-0 px-4">
        <button
          onClick={() => (registered ? setUploadOpen(true) : setCheckoutOpen(true))}
          className="w-full rounded-xl bg-teal py-3 text-white shadow-lg active:scale-[0.99] transition"
        >
          <span className="block font-bold">
            {registered ? t.uploadSubmission : t.register(comp.entry)}
          </span>
          <span className="block text-xs opacity-80">
            {registered ? t.registered : t.spotsLeftShort(comp.spots)}
          </span>
        </button>
      </div>

      {/* Razorpay checkout sheet */}
      <CheckoutSheet
        open={checkoutOpen}
        comp={comp}
        t={t}
        onClose={() => setCheckoutOpen(false)}
        onPaid={() => {
          setCheckoutOpen(false)
          setRegistered(true)
          setToast(t.paidFor(comp.title))
        }}
      />

      {/* Upload submission sheet */}
      <UploadSheet
        open={uploadOpen}
        comp={comp}
        t={t}
        onClose={() => setUploadOpen(false)}
        onDone={() => {
          setUploadOpen(false)
          setToast(t.submissionUploaded)
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="absolute left-1/2 bottom-40 z-[80] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg whitespace-nowrap">
            <span className="text-teal-300">
              <CheckCircle />
            </span>
            {toast}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  )
}

function DateCell({
  icon,
  label,
  date,
  time,
  className = '',
}: {
  icon: ReactNode
  label: string
  date: string
  time: string
  className?: string
}) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <span className="text-teal mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-slate">{label}</p>
        <p className="text-sm font-bold text-ink">{date}</p>
        <p className="text-xs text-slate">{time}</p>
      </div>
    </div>
  )
}

function RewardIcon({ type }: { type: string }) {
  if (type === 'trophy') return <Trophy className="w-5 h-5 text-amber-500" />
  if (type === 'medal')
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        className="text-slate-400"
      >
        <circle cx="12" cy="14" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 3l2 6M16 3l-2 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      className="text-teal"
    >
      <path
        d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ---------- Razorpay checkout ---------- */

type PayMethod = 'upi' | 'cards' | 'netbanking' | 'wallets'
type PayPhase = 'method' | 'processing' | 'success' | 'failed'

const INR = (n: number) => `₹${n.toLocaleString('en-IN')}`

function parseEntry(entry: string): number {
  const n = Number(entry.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 99
}

const UPI_APPS = ['GPay', 'PhonePe', 'Paytm', 'BHIM']
const BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra']
const WALLETS = ['Paytm', 'Amazon Pay', 'Mobikwik', 'Freecharge']

function CheckoutSheet({
  open,
  comp,
  t,
  onClose,
  onPaid,
}: {
  open: boolean
  comp: Competition
  t: (typeof STRINGS)[Lang]
  onClose: () => void
  onPaid: () => void
}) {
  const [phase, setPhase] = useState<PayPhase>('method')
  const [method, setMethod] = useState<PayMethod | null>('upi')
  const [upiId, setUpiId] = useState('')
  const [upiApp, setUpiApp] = useState<string | null>(null)
  const [card, setCard] = useState({ num: '', name: '', exp: '', cvv: '' })
  const [bank, setBank] = useState<string | null>(null)
  const [wallet, setWallet] = useState<string | null>(null)
  const [billOpen, setBillOpen] = useState(false)
  const [txnId] = useState(
    () => 'pay_' + Math.random().toString(36).slice(2, 12).toUpperCase(),
  )

  // Fee breakdown — mirrors a real Razorpay order (base + platform fee + GST,
  // less the referral offer that the page advertises).
  const entry = parseEntry(comp.entry)
  const platformFee = 5
  const gst = Math.round((entry + platformFee) * 0.18)
  const discount = 10
  const total = entry + platformFee + gst - discount

  useEffect(() => {
    if (open) {
      setPhase('method')
      setMethod('upi')
      setUpiId('')
      setUpiApp(null)
      setCard({ num: '', name: '', exp: '', cvv: '' })
      setBank(null)
      setWallet(null)
      setBillOpen(false)
    }
  }, [open, comp.id])

  const canPay =
    (method === 'upi' && (upiApp !== null || upiId.trim().length > 2)) ||
    (method === 'cards' &&
      card.num.replace(/\s/g, '').length >= 12 &&
      card.name.trim().length > 1 &&
      card.exp.length >= 4 &&
      card.cvv.length >= 3) ||
    (method === 'netbanking' && bank !== null) ||
    (method === 'wallets' && wallet !== null)

  const pay = () => {
    setPhase('processing')
    // Simulate the gateway round-trip: processing → bank confirm → success.
    setTimeout(() => setPhase('success'), 2200)
  }

  const dismiss = () => {
    if (phase === 'processing') return // don't let a tap cancel mid-transaction
    onClose()
  }

  const METHODS: { key: PayMethod; icon: ReactNode; label: string }[] = [
    { key: 'upi', icon: <UpiIcon />, label: t.upi },
    { key: 'cards', icon: <CardIcon />, label: t.cards },
    { key: 'netbanking', icon: <BankIcon />, label: t.netbanking },
    { key: 'wallets', icon: <WalletIcon />, label: t.wallets },
  ]

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={dismiss}
        className={`absolute inset-0 bg-ink/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`relative w-full max-w-[430px] max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl bg-canvas shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Razorpay gateway header — deliberately in Razorpay's own blue so the
            checkout reads as the external gateway, not the app chrome. */}
        <div className="bg-[#02042b] px-5 pt-4 pb-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center font-extrabold text-sm">
                f
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold">feedants</p>
                <p className="text-[10px] text-white/60">{comp.title}</p>
              </div>
            </div>
            {phase !== 'processing' && (
              <button
                onClick={onClose}
                aria-label={t.cancelPayment}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] text-white/60">{t.totalPayable}</p>
              <p className="text-2xl font-extrabold tabular-nums">{INR(total)}</p>
            </div>
            <RazorpayMark />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {phase === 'method' && (
            <div className="px-5 py-5 space-y-5">
              {/* Method picker — pick one, only its fields show below */}
              <div>
                <p className="text-xs font-semibold text-slate mb-2.5">{t.payUsing}</p>
                <div className="grid grid-cols-4 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMethod(m.key)}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 transition ${
                        method === m.key
                          ? 'border-teal bg-mint text-teal-dark'
                          : 'border-neutral-200 bg-white text-slate'
                      }`}
                    >
                      {m.icon}
                      <span className="text-[11px] font-semibold leading-none">
                        {m.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected method fields */}
              {method === 'upi' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {UPI_APPS.map((a) => (
                      <button
                        key={a}
                        onClick={() => {
                          setUpiApp(a)
                          setUpiId('')
                        }}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                          upiApp === a
                            ? 'border-teal bg-mint text-teal-dark'
                            : 'border-neutral-200 bg-white text-slate'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[11px] text-slate">{t.upiIdLabel}</label>
                    <input
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value)
                        setUpiApp(null)
                      }}
                      placeholder={t.upiIdPlaceholder}
                      className="mt-1 w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
                    />
                  </div>
                </div>
              )}

              {method === 'cards' && (
                <div className="space-y-2.5">
                  <input
                    inputMode="numeric"
                    value={card.num}
                    onChange={(e) =>
                      setCard((c) => ({
                        ...c,
                        num: e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 16)
                          .replace(/(.{4})/g, '$1 ')
                          .trim(),
                      }))
                    }
                    placeholder={t.cardNumber}
                    className="w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
                  />
                  <input
                    value={card.name}
                    onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                    placeholder={t.nameOnCardPlaceholder}
                    className="w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      value={card.exp}
                      onChange={(e) =>
                        setCard((c) => ({
                          ...c,
                          exp: e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 4)
                            .replace(/(.{2})(.+)/, '$1 / $2'),
                        }))
                      }
                      placeholder={t.expiry}
                      className="rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
                    />
                    <input
                      inputMode="numeric"
                      value={card.cvv}
                      onChange={(e) =>
                        setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))
                      }
                      placeholder={t.cvv}
                      type="password"
                      className="rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
                    />
                  </div>
                </div>
              )}

              {method === 'netbanking' && (
                <div className="space-y-1.5">
                  {BANKS.map((b) => (
                    <button
                      key={b}
                      onClick={() => setBank(b)}
                      className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                        bank === b
                          ? 'border-teal bg-mint text-teal-dark'
                          : 'border-neutral-200 bg-white text-ink'
                      }`}
                    >
                      {b}
                      <span
                        className={`w-4 h-4 rounded-full border-2 ${
                          bank === b ? 'border-teal bg-teal' : 'border-neutral-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              )}

              {method === 'wallets' && (
                <div className="grid grid-cols-2 gap-2.5">
                  {WALLETS.map((w) => (
                    <button
                      key={w}
                      onClick={() => setWallet(w)}
                      className={`rounded-xl border py-3 text-sm font-semibold transition ${
                        wallet === w
                          ? 'border-teal bg-mint text-teal-dark'
                          : 'border-neutral-200 bg-white text-slate'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {phase === 'processing' && (
            <div className="px-6 py-16 flex flex-col items-center text-center">
              <span className="h-14 w-14 rounded-full border-4 border-mint border-t-teal animate-spin" />
              <p className="mt-6 text-base font-bold text-ink">{t.processing}</p>
              <p className="mt-1 text-sm text-slate">{t.redirecting}</p>
              <p className="mt-6 flex items-center gap-1.5 text-[11px] text-slate">
                {t.poweredBy} <RazorpayMark dark />
              </p>
            </div>
          )}

          {phase === 'success' && (
            <div className="px-6 py-12 flex flex-col items-center text-center">
              <span className="relative flex items-center justify-center">
                <span className="absolute w-20 h-20 rounded-full bg-mint animate-ping opacity-60" />
                <span className="relative w-20 h-20 rounded-full bg-teal text-white flex items-center justify-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" {...s} strokeWidth={2.4}>
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </span>
              <p className="mt-6 text-xl font-extrabold text-ink">{t.paymentSuccess}</p>
              <p className="mt-1 text-3xl font-extrabold text-teal tabular-nums">
                {INR(total)}
              </p>
              <p className="mt-2 text-sm text-slate max-w-[260px]">{t.paidFor(comp.title)}</p>
              <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] text-slate shadow-sm">
                {t.txnId}
                <span className="font-semibold text-ink tracking-wide">{txnId}</span>
              </div>
              <button
                onClick={onPaid}
                className="mt-8 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white active:scale-[0.99] transition"
              >
                {t.done}
              </button>
            </div>
          )}

          {phase === 'failed' && (
            <div className="px-6 py-12 flex flex-col items-center text-center">
              <span className="w-20 h-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" {...s} strokeWidth={2.4}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </span>
              <p className="mt-6 text-xl font-extrabold text-ink">{t.paymentFailed}</p>
              <p className="mt-2 text-sm text-slate max-w-[260px]">{t.paymentFailedSub}</p>
              <button
                onClick={() => setPhase('method')}
                className="mt-8 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white active:scale-[0.99] transition"
              >
                {t.retry}
              </button>
            </div>
          )}
        </div>

        {/* Sticky bill + single pay action */}
        {phase === 'method' && (
          <div className="shrink-0 border-t border-neutral-100 bg-white">
            {/* Collapsible breakdown — details on demand, not by default */}
            <div
              className={`grid transition-all duration-300 ease-out ${
                billOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-5 pt-3 space-y-2 text-sm">
                  <Row label={t.entryAmount} value={INR(entry)} />
                  <Row label={t.platformFee} value={INR(platformFee)} />
                  <Row label={t.gst} value={INR(gst)} />
                  <Row
                    label={t.referralDiscount}
                    value={`− ${INR(discount)}`}
                    accent="text-teal"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3">
              <button
                onClick={() => setBillOpen((o) => !o)}
                className="w-full flex items-center justify-between py-1"
              >
                <span className="flex items-center gap-1 text-xs font-semibold text-slate">
                  {INR(total)}
                  <Chevron
                    className={`w-3.5 h-3.5 transition ${billOpen ? 'rotate-180' : ''}`}
                  />
                </span>
                <span className="rounded-md bg-mint text-teal-dark text-[10px] font-semibold px-2 py-0.5">
                  {t.offerApplied}
                </span>
              </button>
              <button
                onClick={pay}
                disabled={!canPay}
                className="mt-1.5 w-full rounded-xl bg-[#3395ff] py-3.5 text-sm font-bold text-white shadow-sm active:scale-[0.99] transition disabled:opacity-40 disabled:active:scale-100"
              >
                {t.payAmount(INR(total))}
              </button>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-slate">
                <span className="text-teal">
                  <Shield />
                </span>
                {t.encrypted}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  accent = 'text-ink',
}: {
  label: ReactNode
  value: string
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate">{label}</span>
      <span className={`font-semibold tabular-nums ${accent}`}>{value}</span>
    </div>
  )
}

function RazorpayMark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <svg width="12" height="14" viewBox="0 0 24 26" aria-hidden="true">
        <path d="M14.5 0L7 14h4l-3.5 12L20 8h-5l3-8z" fill="#3395ff" />
      </svg>
      <span className={`font-bold text-[12px] ${dark ? 'text-[#072654]' : 'text-white'}`}>
        Razorpay
      </span>
    </span>
  )
}

function UpiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M4 12l6-8 4 16 6-8" />
    </svg>
  )
}
function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h3" />
    </svg>
  )
}
function BankIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M4 10h16M5 10l7-5 7 5M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16" />
    </svg>
  )
}
function WalletIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s}>
      <path d="M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7l2-3h11M17 13h.01" />
    </svg>
  )
}

function UploadSheet({
  open,
  comp,
  t,
  onClose,
  onDone,
}: {
  open: boolean
  comp: Competition
  t: (typeof STRINGS)[Lang]
  onClose: () => void
  onDone: () => void
}) {
  const [file, setFile] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [phase, setPhase] = useState<'form' | 'uploading'>('form')

  useEffect(() => {
    if (open) {
      setFile(null)
      setLink('')
      setPhase('form')
    }
  }, [open])

  const canSubmit = file !== null || link.trim().length > 0

  const submit = () => {
    setPhase('uploading')
    setTimeout(onDone, 1400)
  }

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/50 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`relative w-full max-w-[430px] rounded-t-3xl bg-canvas px-5 pb-8 pt-3 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/15" />
        <div className="flex items-center justify-between mt-3 mb-1">
          <h3 className="text-lg font-extrabold text-ink">{t.uploadSubmission}</h3>
          <button onClick={onClose} className="text-slate text-sm font-semibold">
            {t.close}
          </button>
        </div>
        <p className="text-xs text-slate mb-4">{t.for} {comp.title}</p>

        <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal/40 bg-mint/40 py-8 cursor-pointer">
          <span className="w-11 h-11 rounded-full bg-teal text-white flex items-center justify-center">
            <Upload />
          </span>
          <span className="text-sm font-semibold text-ink">
            {file ? file : t.chooseFile}
          </span>
          <span className="text-[11px] text-slate">{t.fileHint}</span>
          <input
            type="file"
            accept="video/*,image/*,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <div className="my-3 flex items-center gap-3 text-[11px] text-slate">
          <span className="flex-1 h-px bg-neutral-200" />
          {t.orPasteLink}
          <span className="flex-1 h-px bg-neutral-200" />
        </div>

        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://youtu.be/…"
          className="w-full rounded-xl bg-white ring-1 ring-neutral-200 px-3.5 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-teal"
        />

        <button
          onClick={submit}
          disabled={!canSubmit || phase === 'uploading'}
          className="mt-4 w-full rounded-xl bg-teal py-3.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {phase === 'uploading' ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              {t.uploading}
            </span>
          ) : (
            t.submitEntry
          )}
        </button>
      </div>
    </div>
  )
}
