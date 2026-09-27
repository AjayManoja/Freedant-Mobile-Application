import { useState } from 'react'
import { PageHeader } from '../ui'

/* ------------------------------------------------------------------ *
 * Terms & Conditions and Privacy Policy — long-form legal documents
 * rendered from a shared structure with a jump-to-section index.
 * ------------------------------------------------------------------ */

type Section = { id: string; heading: string; body: string[] }

function LegalDoc({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: string
  sections: Section[]
}) {
  const [active, setActive] = useState<string | null>(null)

  const jump = (id: string) => {
    setActive(id)
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <PageHeader title={title} subtitle="Legal" />

      <div
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-16 space-y-5 scroll-smooth"
        data-scroll
      >
        <p className="text-[11px] text-slate px-1">Last updated {updated}</p>

        <p className="text-sm text-slate leading-relaxed rounded-2xl bg-white shadow-sm p-4">
          {intro}
        </p>

        {/* Section index */}
        <nav className="rounded-2xl bg-mint p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal px-1 mb-1.5">
            On this page
          </p>
          <div className="flex flex-col">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => jump(s.id)}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition ${
                  active === s.id ? 'text-teal' : 'text-ink'
                }`}
              >
                <span className="w-5 shrink-0 text-xs font-bold text-teal">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {s.heading}
              </button>
            ))}
          </div>
        </nav>

        {/* Sections */}
        {sections.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-24 rounded-2xl bg-white shadow-sm p-4"
          >
            <h2 className="text-base font-extrabold text-ink flex items-baseline gap-2">
              <span className="text-teal text-sm">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="mt-2 space-y-2.5">
              {s.body.map((p, j) => (
                <p key={j} className="text-sm text-slate leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          </section>
        ))}

        <p className="text-center text-[11px] text-slate px-6">
          Questions? Reach us at legal@feedants.com
        </p>
      </div>
    </>
  )
}

export function TermsPage() {
  return (
    <LegalDoc
      title="Terms & Conditions"
      updated="September 1, 2026"
      intro="Welcome to Feedants. By creating an account or entering a competition you agree to these Terms. Please read them carefully — they set out the rules for hosting, joining, and winning competitions on our platform."
      sections={[
        {
          id: 'eligibility',
          heading: 'Eligibility',
          body: [
            'You must be at least 13 years old to use Feedants, and 18 or older to host a paid competition or withdraw prize money. Minors may participate only with the consent of a parent or legal guardian.',
            'You are responsible for keeping your account credentials secure and for all activity that happens under your account.',
          ],
        },
        {
          id: 'competitions',
          heading: 'Competitions & submissions',
          body: [
            'Hosts set the rules, prizes, and deadlines for each competition. By submitting an entry you confirm that the work is original, that you own or have licensed all rights to it, and that it does not infringe anyone else’s rights.',
            'Feedants may remove any submission that violates these Terms, our community guidelines, or applicable law. Judging decisions made by hosts and appointed judges are final.',
          ],
        },
        {
          id: 'payments',
          heading: 'Fees, prizes & payouts',
          body: [
            'Entry fees, if any, are shown before you join and are processed securely through Razorpay. Refunds are available until a competition begins, as described in our Help Centre.',
            'Prize winnings are credited to your in-app Wallet, typically within 48 hours of results, and can be withdrawn to a verified UPI ID or bank account. You are responsible for any taxes on prizes you receive.',
          ],
        },
        {
          id: 'conduct',
          heading: 'Acceptable use',
          body: [
            'Do not harass other users, post unlawful or harmful content, attempt to manipulate voting or judging, or use the platform to distribute spam or malware.',
            'We may suspend or terminate accounts that breach these Terms, with or without notice, and may withhold prizes obtained through fraud or cheating.',
          ],
        },
        {
          id: 'liability',
          heading: 'Disclaimers & liability',
          body: [
            'Feedants is provided “as is”. To the fullest extent permitted by law, we are not liable for indirect or consequential losses arising from your use of the platform.',
            'These Terms are governed by the laws of India, and any disputes are subject to the exclusive jurisdiction of the courts of Mumbai, Maharashtra.',
          ],
        },
        {
          id: 'changes',
          heading: 'Changes to these Terms',
          body: [
            'We may update these Terms from time to time. When we make material changes we’ll notify you in the app. Continued use after an update means you accept the revised Terms.',
          ],
        },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="September 1, 2026"
      intro="Your privacy matters to us. This policy explains what information Feedants collects, how we use it, and the choices you have. We only collect what we need to run competitions and improve your experience."
      sections={[
        {
          id: 'collect',
          heading: 'Information we collect',
          body: [
            'Account details you provide — your name, username, email, phone number, city, and profile photo.',
            'Content you create, such as competition entries, messages, and submissions.',
            'Usage and device information, including app interactions, approximate location, and diagnostics, used to keep the service secure and reliable.',
          ],
        },
        {
          id: 'use',
          heading: 'How we use your data',
          body: [
            'To operate competitions, process entries and payouts, personalise your feed, and send you relevant notifications.',
            'To keep Feedants safe — detecting fraud, abuse, and violations of our Terms.',
            'You control marketing emails, personalised ads, and activity status from Settings → Privacy at any time.',
          ],
        },
        {
          id: 'sharing',
          heading: 'When we share information',
          body: [
            'With competition hosts and judges, limited to what’s needed to evaluate your entry.',
            'With trusted service providers such as our payment processor (Razorpay) and cloud hosting, under strict confidentiality obligations.',
            'We never sell your personal data. We may disclose information if required by law or to protect the rights and safety of our users.',
          ],
        },
        {
          id: 'rights',
          heading: 'Your rights & choices',
          body: [
            'You can access and edit your profile at any time, download a copy of your data from Settings → Privacy, and delete your account permanently from Settings.',
            'Deleting your account removes your profile, submissions, and wallet history, subject to any records we must retain for legal or accounting reasons.',
          ],
        },
        {
          id: 'security',
          heading: 'Data security & retention',
          body: [
            'We protect your data with encryption in transit, access controls, and regular security reviews. No system is perfectly secure, so we encourage you to use a strong password and two-factor authentication.',
            'We keep your information only as long as your account is active or as needed to provide the service and meet legal obligations.',
          ],
        },
        {
          id: 'contact',
          heading: 'Contacting us',
          body: [
            'For any privacy questions or requests, email privacy@feedants.com. We aim to respond within 30 days.',
          ],
        },
      ]}
    />
  )
}
