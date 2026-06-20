# timeoff — Marketing & GTM Strategy

Captures the marketing discussion (Jun 2026) — channel reality, the
phone-bundle question, and the recommended path for a solo bootstrapped
founder. Pairs with `IDEAS.md` (product strategy).

> **See `RESEARCH_FINDINGS.md`** for the source-cited deep-research backing
> these recommendations (case studies, conversion benchmarks, validation
> thresholds, and the regulatory verdict). Key correction from that research:
> **regulation is NOT a GTM tailwind** — EU DSA / UK OSA / EUDI commoditise the
> function rather than open a third-party market. Treat any "ride the
> regulation" idea below as superseded by RESEARCH_FINDINGS.md §6.

---

## 1. The discoverability problem

The buyer is on a phone store. The product (PC agent) lives on Windows.
**Parents do not open the App Store and search "PC time management."**
They Google "how to limit kid's computer time" — and that traffic lands on
web pages, not app store listings.

### What parents actually search

**App stores** (low intent for our use case)
- "screen time" — dominated by Apple Screen Time, Google Family Link
- "parental control" — Bark, Qustodio, Mobicip
- ~95% of these searches care about the *phone in their hand*, not the kid PC.

**Google / web** (where our buyers actually live)
- "how to limit computer time for kids" — 8–12k US/mo
- "block games on my child's pc" — 3–5k/mo
- "windows parental controls" — 30–50k/mo (Microsoft Family Safety dominates)
- "minecraft time limit pc", "roblox time limit windows" — long-tail goldmine
- "block discord on kids computer" — sharp pain, low competition

Qustodio/Bark spend serious money on these terms; they convert at 5–10× the
app-store install rate.

### Why this is actually good news

PC-first parental control is **a clear positioning niche**. Every competitor
treats Windows as an afterthought:
- Bark — mobile-first; Bark Phone is the flagship
- Qustodio — Windows works but is de-emphasized
- Norton Family — bundled with antivirus, hidden
- Apple Screen Time / Family Link — phone-only by definition
- Microsoft Family Safety — Windows-native, free, but universally hated
  (Chrome-blocking bug, unreliable limits)

**Nobody owns "the parental control built for the gaming PC."** That's where
the 9–14yo family conflict actually lives (Steam, Discord, Minecraft, Roblox).

---

## 2. Why the "obvious" playbook fails a solo founder

The standard "build a website + run ads + write SEO posts" plan assumes
$50k/mo to burn. The honest reality:

- **SEO**: Qoria (Qustodio parent) booked $145M ARR in FY25. You cannot
  out-rank them in a 12-month window.
- **Paid ads**: Bark's cost-per-install on "parental controls" is $20–40.
  You'd burn $5k before learning anything useful.
- **Hiring content writers**: defeats the founder-story advantage that is
  literally your only edge.
- **App Store ASO**: a multiplier on demand, not a creator of demand. Useless
  until you have proof families want this.

**Stop trying to beat them at distribution. Find channels where they can't
compete.**

---

## 3. Four channels where a solo founder actually wins

### 3.1 Build in public
You're a parent solving your own kid's PC problem. Qustodio's marketing team
literally cannot tell that story. Post on X / Bluesky / LinkedIn:
- "Day 14: kid found the date-change Screen Time bypass. Here's the PC fix."
- "I refuse to let a parental-control company sell my kid's location. Source
  is on GitHub."
- Screenshots of your own dashboard locking your own kid's Minecraft.

Cost: $0. Compounds. One mid-viral HN/Reddit post = 200 signups overnight.

### 3.2 Pick ONE Reddit/Discord community for 3 months
Top candidates, ordered by realism:
- **r/ADHD_Parenting** (45k) — these parents can't use Apple Screen Time
  effectively; our ND mode + transparency angle was built for them.
- **r/Parents_of_Roblox** + Facebook Minecraft-mom groups — incumbents
  barely cover game-specific PC blocking.
- **r/homeschool** (300k) — heavy PC use, distrust of surveillance, sharply
  pro-transparency. Strongest fit.

Lurk a week. Answer questions for 90 days without selling. Drop the link
only when directly relevant. **3 months of this beats 6 months of SEO**.

### 3.3 One YouTuber/blogger with a parent audience
Not influencers — *practitioners*:
- Homeschool YouTubers with 30k subs whose kids use Windows.
- Tech Wellness / Wait Until 8th adjacent crowd.
- Common Sense Media reviewers (they take cold pitches).
- ND/ADHD parenting podcasters — actively recommend tools that respect
  kid autonomy.

One champion creator > 100 SEO posts. Their endorsement transfers trust no
amount of self-marketing can buy.

### 3.4 School / pediatrician backdoor
Qoria's *real* revenue is K-12 ($127M of $145M ARR). Consumer is leftover.
- One sympathetic school counselor at a 200-family school = 100-customer
  pipeline.
- Pediatricians who screen for problematic gaming hand out paper printouts
  of recommended tools.
- ADHD coaches at $200/hr need to recommend tools. Affiliate them.

Grinding, but the only B2B-ish path open to a solo founder. Customers from
this channel **don't churn**.

---

## 4. 90-day plan

**Month 1** — Pick one community (recommend r/ADHD_Parenting). Lurk a week.
Answer questions, no link in profile yet. Launch a thread: *"I'm a parent
+ dev who got fed up with Apple Screen Time. Spent 6 months building an
open-source PC time manager where the data stays on your own server. AMA."*
Drop the GitHub. The ADHD-parenting crowd will stress-test it for you — free
QA from your exact ICP.

**Month 2** — Take the feedback, fix rough edges. Ship a single-page website
(no SEO theater — GitHub link, install command, philosophy). Post on
HackerNews on a Tuesday morning: *"Show HN: timeoff — open-source parental
control for Windows that doesn't sell your kid's data."* HN loves this
story. Even #20 ranking = 500 visits, 5–10 will be parents who blog/podcast.

**Month 3** — Interview every retained user. Ask "would you pay $5/mo for
this?" If 60% say yes, charge. Use the first $1k to send free phones to
3 ND parenting podcasters.

**Spend so far**: founder time + ~$200 (podcaster phones + Stripe fees).
**Realistic outcome**: 50–200 paying families by month 6. That's $300–1200
MRR. Not life-changing, but a real wedge into a market that doesn't see
you coming, with retention competitors can't match.

---

## 5. What to NOT do

- ❌ Pay for Google Ads against Bark's terms. You will lose 100% of $5k+.
- ❌ Hire a content writer. You're the only credible voice.
- ❌ Build for "everyone." Build for ADHD/ASD households with a Windows
  gaming PC.
- ❌ Spend on App Store ASO until you have proof of demand.

---

## 6. The honest reframe

You are **not** competing with Bark. You are competing with the **status
quo of every ADHD parent who hates Microsoft Family Safety, doesn't trust
Bark, and is currently doing nothing**. That market has zero defenders —
incumbents wrote it off as too small. Perfect for one person.

> The big names own the search term *parental control*.
> You can own *the dad who built the one that doesn't watch your kid*.

Different products to different buyers. Compete in your category, not theirs.

---

## 7. The phone-bundle question

> Should we build an iOS + Android time-management app first, then upsell PC?

### Feasibility

**iOS** — yes but heavily constrained.
- Only legal API: **Family Controls + ManagedSettings + DeviceActivity**
  (iOS 16+). App blocking, time limits, scheduled downtime — runs **on the
  child's device only**.
- Requires **Apple entitlement approval** (weeks to months, revocable,
  frequently denied for indies). Apple killed every MDM-based competitor
  in April 2019 — not coming back.
- Parent's phone can't reach into kid's iPhone unless **both are in Apple
  Family Sharing** and both have your app.
- **Apple Screen Time is free and built-in.** You're competing with the OS.
- Persistent iOS 18/26 bugs make Screen Time unreliable — a real gap, but
  Apple keeps almost-fixing it.

**Android** — more freedom, with traps.
- **DevicePolicyManager** + UsageStatsManager + Accessibility. Either go
  full **Device Owner** (factory reset — kid-phone use-case) or be a
  regular app with Accessibility permission.
- **Google Family Link is free and built-in** — same OS-incumbent problem.
- Play Store tightened **stalkerware policy hard** (2024–2026). Any app
  that monitors a user other than the device owner needs explicit consent
  UI + full disclosure or it gets pulled. Bark, Qustodio, Mobicip all hit.
  This aligns with our transparency philosophy — but the review process
  is brutal for newcomers.

**Hardest truth**: the phone parental-control market is the most crowded
vertical in consumer software. Bark, Qustodio, Aura, Norton, Mobicip, Net
Nanny all fight for the same buyer and lose kid-side trust at the same
rate.

### Pros / cons

| Lens | Pros | Cons |
|---|---|---|
| TAM | Phone search ~10–50× larger than PC. 95% teens own phones. | CAC also 10×. Bark spends $20–40/install. |
| Bundle story | "Manage both, one app" — no incumbent does both well. | Triples eng surface — 3 agents on 3 OS update cycles. |
| Distribution | Lines up with where parents already are. | Apple entitlement gate can deny/revoke any time. |
| Pricing | Bundle = $9–12/mo perceived value. | Priced into Qustodio/Bark territory; their brand outguns. |
| Story | "Started where the fight is loudest — PC gaming — grew into phones." | Launching all platforms at once kills the story; you're app #47. |
| Moat | Privacy/transparency works on every platform. | Spread thin = moat thins. Bark has 10 engineers on iOS edge cases alone. |

### Verdict

**Don't build full phone enforcement as a solo founder.** You'll spend 12
months building iOS Family Controls integration, get the entitlement
approved, ship to the App Store — and then you're feature #47 against
companies that outspend you in a week.

**But the phone CAN be a smart funnel.**

---

## 8. Proposal — phone as funnel, PC as moat

### Phase 1 (4–8 weeks) — "Screen Time Reader": free, viewer-only iOS/Android app

- **iOS**: `DeviceActivityReport` (the *reporting-only* Family Controls API
  — **not gated** by an entitlement). Shows yesterday's phone usage by app.
  No blocking.
- **Android**: public `UsageStatsManager`. Same — read-only.
- Layered on top: existing **kid-PC controls** as a paid upgrade unlock.

Why it works:
- **Apple won't reject it** — no enforcement, no Family Sharing required,
  no entitlement.
- **Apple Screen Time itself does this badly** — reports are buggy and
  shallow. You can do better: week-over-week, weekend vs weekday, "your
  kid spent 4h on TikTok yesterday" surfaced clearly.
- **The kid actually uses it** because it's *their* data — disclosure
  paradox (Stattin & Kerr 2000).
- **App Store presence + ASO + reviews** without fighting Bark on
  enforcement.
- **Earns the right to upsell PC**: "You can see her phone hours — now
  lock her gaming PC at bedtime, too. +$5/mo."

### Phase 2 (months 3–6) — iOS soft enforcement via Family Controls

Once you have users and reviews:
- Apply for Family Controls entitlement.
- Add **soft blocking** (kid-installed, kid-consented). Screen Time-style
  downtime running on the kid's iPhone.
- Keep the philosophy: kid sees everything, kid requests more, parent
  approves.

Defensible now because:
- Paying base from the PC product already exists.
- Phone is bundled add-on, not main course.
- You don't need entitlement to launch — viewer already shipped.

### Phase 3 (months 6–12) — Android via Device Owner (kid-phone path)

- **Skip the consumer Android control market** — it's a swamp.
- Position Android as: **"if you set up the kid's first phone with timeoff,
  parental controls are baked in."** Pinwheel/Gabb wedge without the
  hardware risk.

### Pricing in the bundle

| Plan | Price | What |
|---|---|---|
| Free | $0 | Phone usage **viewer** (iOS + Android), no enforcement. Drives signups. |
| **Family** | **$9/mo or $79/yr** | Phone viewer + 1 PC agent + parent dashboard + bank + chores. |
| Family+ | $12/mo or $99/yr | Same + up to 5 PCs/phones + co-parent sharing + priority approval push. |

Anchors against Qustodio Basic ($59/yr) and Bark Premium ($99/yr) on
price; beats them on the bundle story; kills them on transparency.

### What to ship next, concretely

1. **iOS + Android viewer app** in React Native + Expo (reuses 60–70% of
   current Expo code). Read-only `UsageStats` on Android,
   `DeviceActivityReport` on iOS. **2–3 weeks** for parent view.
2. **Kid-side phone app** — shows the kid their own usage + lets them send
   requests/chores to parent. **1–2 weeks** (UI; backend already exists).
3. **App Store / Play Store listing** as
   **"timeoff — Family screen time, without surveillance."**
4. PC enforcement stays the paid wedge. Reframe: **"the upgrade that closes
   the gaming-PC gap Apple Screen Time can't reach."**

### Validation gate before committing further

Ship Phase 1 (viewer). **Validate** that adding phone viewer actually lifts
PC-side conversion before building enforcement.

- If 200 viewer signups → 5+ PC paying customers, the bundle thesis is
  real; continue to Phase 2.
- If 200 viewer signups → 0 paying customers, the bundle thesis is wrong;
  save 6 months and stay PC-focused.

### Why this avoids the trap

You don't become Bark competitor #48. You become **"the honest one across
all the family's screens, with a real PC product nobody else has."** The
moat (transparency, self-hosting, PC-first) stays intact; the phone is the
funnel that brings store-search buyers into the funnel.

---

## 9. Decision summary

| Question | Answer |
|---|---|
| Should we SEO/ads-fight Bark/Qustodio for "parental controls"? | No. |
| Should we build full iOS + Android enforcement first? | No. |
| Should we ship a free iOS/Android **viewer** to drive PC adoption? | **Yes — Phase 1.** |
| Should PC remain the paid wedge with the unique moat story? | Yes. |
| Marketing channel for first 3 months? | r/ADHD_Parenting + Show HN + 1 podcaster. |
| Pricing target once bundled? | $79/yr or $9/mo; 30-day refund; one-tap cancel. |
| Validation gate before Phase 2 (enforcement)? | 200 viewer signups → ≥5 PC paying conversions. |
