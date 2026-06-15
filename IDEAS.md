# timeoff — Strategy & Ideas

Captured from competitive landscape research (Jun 2026). Sources: Pew 2024–25,
Common Sense Census, Ghosh/Wisniewski CHI/CSCW papers, Stattin & Kerr 2000,
Ryan & Deci SDT, EPFL parental-app privacy study, Qoria FY25 disclosures,
RevenueCat State of Subs 2025, TechCrunch stalkerware coverage, Mozilla
*Privacy Not Included, NetChoice v. Bonta, EU DSA Art. 28 Guidelines, UK OSA
Ofcom Codes, BBB Gabb complaints, Trustpilot Pinwheel/Gabb reviews.

## The bet in one sentence

> The only parental-control app built on the only finding that replicates —
> kids who know what's tracked and can negotiate it are safer than kids under
> surveillance — and the only one where the data never leaves the family.

## Add (in order of impact)

### 1. Co-parent-aware controls
**Why.** OurFamilyWizard owns co-parenting comms (court-recommended, hundreds
of thousands of US families) but ships zero device controls. No
parental-control app handles split households. We already have co-parent sync
at the data layer — surface it.

**What.** Separate quiet hours per parent (already supported via per-user
prefs), per-request "approved by" stamp on time/chore decisions, audit trail
in activity feed.

### 2. Privacy-as-wedge, loud
**Why.** EPFL: ~70% of Android parental-control apps share kid data without
consent; ~75% embed ad/analytics SDKs. mSpy (2.4M emails, 2024), pcTattletale
(138k, 2024), Cocospy/Spyic (2.65M, 2025) all leaked. Mozilla *Privacy Not
Included flagged Life360. Our architecture is self-hosted, no analytics, no
third-party sharing — a credibility gap incumbents can't close.

**What.** Headline in onboarding + Privacy card in Settings stating exactly
what's collected, where it lives, who reads it.

### 3. Clinical/research-backed coaching nudges
**Why.** Aura is the only competitor doing structured coaching (clinical-psych
validated). We already shipped the Wisdom tab — extend it into *contextual*
nudges that read device telemetry: requests, used minutes, bedtime conflicts.
Example: "Linas asked for +15 three nights this week, all after 20:30.
Coyne 2023: one extended bedtime per week reduces conflict without raising
average use. Try approving?"

**What.** `computeContextualNudges(device, requests, age)` in `lib/wisdom.ts`;
render on device detail above existing Insights.

### 4. Kid-side disclosure surface (promote it)
**Why.** Stattin & Kerr 2000 (most-cited paper in the field): knowledge
derived from kid disclosure protects more than surveillance does. We shipped
the "What your parent sees / doesn't see" page on /kid — but it's hidden.

**What.** Surface link in onboarding ("show this to your kid") and in
Settings → Account.

### 5. Neurodivergent specialization
**Why.** CHADD runs ND tech study; Understood.org builds tools. No competitor
partnered. ADHD/ASD families churn least (anecdotal across forums) and are
underserved. Cheap moat candidate.

**What.** Per-device "ADHD / executive-function support" toggle in Settings.
When on: warmer transition warnings, longer no-surprise grace, ND-tagged tips
in Wisdom. New `TipTag = 'adhd'`.

## Cut / don't build

- **AI message/chat scanning** — Bark/Aura territory. False positives (Bark
  CEO admitted "KMS"→suicide flag) destroy trust. Directly contradicts the
  disclosure-first philosophy.
- **Kid phone hardware** — Pinwheel screens shatter day-one (Trustpilot);
  Gabb failed to respond to 156 BBB complaints. Capital-intensive, low margin.
- **Streaks/badges/coin economies** beyond the bank — Lepper 1973
  overjustification crowds out intrinsic self-regulation.
- **Stealth mode** — stalkerware category is the most-breached in security
  press (TechCrunch Feb 2026); FTC banned SpyFone outright (2021).
- **Platform parity arms race** — Apple DeclaredAgeRange (iOS 26) + EU
  age-verification wallet commoditize basic gating. Compete on philosophy,
  not feature checklists.

## Keep but reframe

- **Schedules / blocklist / limits** — table stakes per SafeWise 2026. Don't
  market as differentiators.
- **Bank + chore requests** — keep, but lean into the kid-voice framing
  (Wisniewski 2017: only 11% of safety-app features support teen
  self-regulation; ours does).

## Pricing

Category at $50–110/yr (Qustodio $59.95–$109.95, Bark $99, Net Nanny $54.99).
Don't undercut — privacy buyers don't shop on price.

**Target: $79/yr or $9/mo. 30-day no-questions refund. One-tap cancel.**

Cancel friction is a top-3 complaint across Bark/Norton/Net Nanny.

## Biggest risk

Ghosh 2018: 79% of kid reviews of control apps ≤2 stars. Market quits when
kid quits. Onboarding + kid page address this — but the harder test is the
parent's first 30 days. RevenueCat: ~30% of annual subs cancel inside 30 days.
Win the first week with one daily micro-win, not feature catalogs.
