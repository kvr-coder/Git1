// Evidence-based screen-time guidance, cited from peer-reviewed sources.
// Every tip is age-banded and tagged so we can surface the right ones to the
// right control. Citations are short — the full source URL is in `source`.

import type { Device } from './types';

export type AgeBand = '6-9' | '10-13' | '14-16';
export type Sex = 'all' | 'boys' | 'girls';
export type TipTag =
  | 'daily-limit'
  | 'bedtime'
  | 'schedule'
  | 'blocklist'
  | 'bank'
  | 'requests'
  | 'chores'
  | 'general'
  | 'gaming'
  | 'social'
  | 'sex-diff'
  | 'sleep'
  | 'adhd'
  | 'autism';

export interface ConversationScript {
  id: string;
  scenario: string;     // e.g. "Bedtime fight over phone"
  ages: AgeBand[];
  approach: string;     // method name shown
  say: string[];        // verbatim parent lines
  source: string;
  url?: string;
}

export interface Reading {
  id: string;
  title: string;
  citation: string;
  url: string;
  blurb: string;
}

export interface Tip {
  id: string;
  title: string;
  body: string;
  /** Tip is most relevant for these age bands. Empty = all ages. */
  ages: AgeBand[];
  /** Where this tip surfaces. */
  tags: TipTag[];
  /** Short source attribution shown inline. */
  source: string;
  /** Optional URL to the paper. */
  url?: string;
}

export const WISDOM: Tip[] = [
  // ── General ──────────────────────────────────────────────
  {
    id: 'cap-humility',
    title: 'Hour-caps aren’t backed by strong evidence',
    body:
      'AAP, WHO and RCPCH all declined to set numeric screen-time limits for ages 6–18 — they recommend a family-negotiated plan focused on quality, routines and what gets displaced (sleep, exercise, in-person time).',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['daily-limit', 'general'],
    source: 'AAP 2016/2024 · WHO 2019 · RCPCH 2019',
    url: 'https://publications.aap.org/pediatrics/article/138/5/e20162592',
  },
  {
    id: 'tiny-effects',
    title: 'The effect of screen-hours on wellbeing is tiny',
    body:
      'A multiverse analysis of 355,358 teens found tech use explains ~0.4% of wellbeing variance — comparable to eating potatoes. Worry less about the number, more about what it replaces.',
    ages: ['10-13', '14-16'],
    tags: ['general'],
    source: 'Orben & Przybylski 2019, Nature Human Behaviour',
    url: 'https://www.nature.com/articles/s41562-018-0506-1',
  },
  {
    id: 'bedroom-device',
    title: 'Devices out of bedrooms — even if “off”',
    body:
      'A meta-analysis of 125,198 kids found device presence in the bedroom raised the odds of inadequate sleep by 79% even when not used. Mere availability disrupts sleep.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bedtime', 'schedule', 'general'],
    source: 'Carter et al. 2016, JAMA Pediatrics',
    url: 'https://jamanetwork.com/journals/jamapediatrics/fullarticle/2571467',
  },

  // ── Routines & bedtime ───────────────────────────────────
  {
    id: 'routine-beats-cap',
    title: 'Routine beats minute-counting for under-10s',
    body:
      'Executive function is still maturing — self-imposed limits fail. A consistent wind-down sequence (bath → quiet activity → lights off, same time, 5+ nights/week) reliably improves sleep onset.',
    ages: ['6-9'],
    tags: ['daily-limit', 'bedtime', 'schedule'],
    source: 'Mindell et al. 2009/2015, Sleep',
    url: 'https://academic.oup.com/sleep/article/32/5/599/2454387',
  },
  {
    id: 'cutoff-window',
    title: 'A “last screen” cutoff probably helps',
    body:
      'Only one RCT (toddlers) directly tested cutting screens 1 hour before bed: sleep efficiency improved (d=0.56) but total duration didn’t. Treat the “60 min before bed” rule as a sensible default, not a magic number.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bedtime', 'schedule'],
    source: 'Pickard et al. 2024, JAMA Pediatrics',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11581737/',
  },

  // ── Blocklist / restrictions ─────────────────────────────
  {
    id: 'forbidden-fruit',
    title: 'Hard bans backfire from about age 11',
    body:
      'Identical games rated higher made teens want them more in a 310-kid study — the “forbidden fruit” effect. Under age 8 the same warnings *reduce* interest. Reserve hard blocks for teens carefully.',
    ages: ['10-13', '14-16'],
    tags: ['blocklist'],
    source: 'Bijvank et al. 2009, Pediatrics',
    url: 'https://publications.aap.org/pediatrics/article-abstract/123/3/870',
  },
  {
    id: 'restrictive-only-misses',
    title: 'Restrictive rules without conversation backfire',
    body:
      'Adolescents under heavy restriction without dialogue showed *more* positive attitudes toward forbidden content and were more likely to seek it with peers. Active discussion + moderate limits work best.',
    ages: ['10-13', '14-16'],
    tags: ['blocklist', 'general'],
    source: 'Nathanson 2002, Media Psychology',
  },

  // ── Bank, chores, rewards ────────────────────────────────
  {
    id: 'overjustification',
    title: 'Pay for hard things, not for fun things',
    body:
      'Paying preschoolers to draw — something they loved — halved their free-time drawing weeks later. Use the bank to reward chores/homework, not activities the kid already enjoys.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bank', 'chores'],
    source: 'Lepper, Greene & Nisbett 1973; Deci et al. 1999 meta',
    url: 'https://bingschool.stanford.edu/sites/bingschool/files/1975_leppergreene.pdf',
  },
  {
    id: 'premack-works',
    title: 'Chore → screen time is a sound trade',
    body:
      '“High-probability behaviour reinforces a low-probability behaviour” — kids will do less-preferred tasks (chores) to access preferred ones (screens). Hold the contingency consistently.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bank', 'chores'],
    source: 'Premack 1959, Psychological Review',
  },
  {
    id: 'praise-verbal',
    title: 'Pair the bank with verbal praise',
    body:
      'Tangible expected rewards can shrink intrinsic motivation (d≈-0.36 across 128 studies). Adding *unexpected verbal praise* doesn’t — and it sticks after the rewards stop.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bank', 'chores'],
    source: 'Deci, Koestner & Ryan 1999, Psychological Bulletin',
  },

  // ── Requests / conflict ──────────────────────────────────
  {
    id: 'authoritative',
    title: 'Be warm AND firm — both, not one',
    body:
      'Across 2,300 teens followed for a year, kids in authoritative families (warmth + structure) outperformed every other style on grades, mental health and self-control. Set the rule clearly, listen, then hold it.',
    ages: ['10-13', '14-16'],
    tags: ['requests', 'general'],
    source: 'Steinberg et al. 1994, Child Development',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8045165/',
  },
  {
    id: 'coercive-cycle',
    title: 'Don’t threaten what you’ll cave on',
    body:
      'Saying “five more minutes” and giving in when they argue *teaches* escalation — every parent who tries it confirms it. If you set a limit, hold it. If you can’t hold it, don’t set it.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['requests', 'general'],
    source: 'Patterson 1982, Coercive Family Process',
  },
  {
    id: 'cps-conversation',
    title: 'Two questions defuse most fights',
    body:
      '“What’s up — what makes stopping hard right now?” → listen. Then: “Here’s my concern.” Then together: “What could we try?” Equally effective as standard parent training and produces less resentment.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['requests', 'general'],
    source: 'Greene et al. 2004 RCT, JCCP',
    url: 'https://livesinthebalance.org/wp-content/uploads/2021/06/Greene-JCCP-2004.pdf',
  },
  {
    id: 'mi-script',
    title: 'For teens: ask before telling',
    body:
      '“What do you like about how you’re using your phone right now — and what, if anything, bugs you about it?” Motivational-interviewing-style openers produce better behaviour change than lectures.',
    ages: ['14-16'],
    tags: ['requests', 'general'],
    source: 'Naar-King & Suarez 2011',
  },

  // ── Surveillance / tampering ─────────────────────────────
  {
    id: 'disclosure-beats-tracking',
    title: 'Tracking is weaker than they’re telling you',
    body:
      'In 1,186 Swedish 14-year-olds, *child disclosure* explained far more variance in healthy behaviour than parental tracking. Surveillance without conversation predicts less disclosure, not safer kids.',
    ages: ['10-13', '14-16'],
    tags: ['general'],
    source: 'Kerr & Stattin 2000, Developmental Psychology',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10830980/',
  },

  // ── Gaming / addiction signals ───────────────────────────
  {
    id: 'gaming-disorder',
    title: 'Hours played isn’t the warning sign — impairment is',
    body:
      'A teen playing 4h/day with stable grades, friends and sleep is not “addicted”. Watch for impaired control, lying about use, withdrawal/anger when stopped, declining sleep and school. Hours alone don’t qualify.',
    ages: ['10-13', '14-16'],
    tags: ['gaming', 'general'],
    source: 'WHO ICD-11 6C51 · Petry et al. 2014',
  },

  // ── Gaming on the PC (the core use-case) ─────────────────
  {
    id: 'game-stop-points',
    title: 'Games are built to be hard to stop — use natural breakpoints',
    body:
      'Ranked matches, raids and queues have no clean “end”. A cut-off at a random minute lands mid-game and feels like a punishment. Tie limits to match/round ends where you can, and always give a 5–10 min heads-up so they can save or finish — this is exactly what the “save your game” warning does.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['gaming', 'schedule'],
    source: 'King & Delfabbro 2018, structural game features',
  },
  {
    id: 'game-variable-reward',
    title: 'Why “just one more game” is real, not defiance',
    body:
      'Loot drops, ranked progress and battle-pass timers run on variable-ratio reward schedules — the most habit-forming pattern known. The pull is engineered. Naming it with your kid (“the game is designed to keep you going”) works better than treating it as a willpower failure.',
    ages: ['10-13', '14-16'],
    tags: ['gaming', 'general'],
    source: 'Skinner variable-ratio · King & Delfabbro 2018',
  },
  {
    id: 'game-co-play',
    title: 'Play with your younger kid before you police it',
    body:
      'For under-10s, sitting in on Minecraft or Roblox for 15 minutes teaches you what they’re doing and makes limits feel shared, not imposed. Co-use is the one mediation style that consistently predicts better outcomes.',
    ages: ['6-9'],
    tags: ['gaming', 'general'],
    source: 'Chen & Shi 2018 meta-analysis (active/co-use mediation)',
  },

  // ── Blue-light hype ──────────────────────────────────────
  {
    id: 'blue-light-hype',
    title: 'Blue-light glasses don’t do much',
    body:
      'A Cochrane review of 17 RCTs found blue-light filters likely make no difference to eye strain, sleep, or eye health. The American Academy of Ophthalmology does not recommend them.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['bedtime', 'general'],
    source: 'Cochrane 2023 · AAO position',
    url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD013244.pub2/full',
  },

  // ── Sleep ────────────────────────────────────────────────
  {
    id: 'sleep-hours',
    title: 'How much sleep your kid actually needs',
    body:
      'The American Academy of Sleep Medicine consensus: 9–12 hours for ages 6–12, 8–10 hours for ages 13–18. The size of the sleep effect on wellbeing dwarfs the screen-time effect.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['sleep', 'bedtime', 'schedule', 'general'],
    source: 'Paruthi et al. 2016, J Clin Sleep Med',
    url: 'https://jcsm.aasm.org/doi/full/10.5664/jcsm.5866',
  },
  {
    id: 'sleep-vs-screens',
    title: 'Sleep predicts mood more than screen-time does',
    body:
      'In 50,212 US kids, each extra hour of screens cost only 3–8 minutes of sleep and explained <1.9% of sleep variance. The bigger lever is total sleep, not minute caps on apps.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['sleep', 'general'],
    source: 'Przybylski 2019, J Pediatrics',
    url: 'https://www.jpeds.com/article/S0022-3476(18)31384-2/abstract',
  },

  // ── Goldilocks ───────────────────────────────────────────
  {
    id: 'goldilocks',
    title: 'Moderate is better than zero',
    body:
      'In 120,115 UK 15-year-olds, light-to-moderate digital use related to *higher* wellbeing than abstinence; harm only appeared at very high use. Beware the "all screens are bad" frame.',
    ages: ['10-13', '14-16'],
    tags: ['general', 'daily-limit'],
    source: 'Przybylski & Weinstein 2017, Psychological Science',
    url: 'https://journals.sagepub.com/doi/10.1177/0956797616678438',
  },

  // ── Boys vs girls on a PC ────────────────────────────────
  {
    id: 'pc-boys-gaming',
    title: 'Boys: the risk is competitive gaming time-loss',
    body:
      'On a home PC, boys skew heavily to competitive multiplayer (Fortnite, CS, League). Problematic-use scores run higher in boys, and the “lost track of time” pattern clusters around ranked play. Watch session length and what it displaces — sleep, homework — not just total hours.',
    ages: ['10-13', '14-16'],
    tags: ['sex-diff', 'gaming'],
    source: 'Mazurek & Engelhardt 2013 · WHO gaming-disorder 2019',
    url: 'https://publications.aap.org/pediatrics/article/132/2/260',
  },
  {
    id: 'pc-girls-social',
    title: 'Girls: the pull is social, even on the desktop',
    body:
      'Girls more often use the PC for Discord, group chats and browser social. The healthy-vs-harmful split is passive scrolling (worse for mood) vs active chatting with friends they actually know (fine). Aim limits at the feed-scrolling, keep the real friend contact.',
    ages: ['10-13', '14-16'],
    tags: ['sex-diff', 'social'],
    source: 'Verduyn et al. 2015/2017 (passive vs active use)',
    url: 'https://ppw.kuleuven.be/okp/_pdf/Verduyn2015PFUUA.pdf',
  },
  {
    id: 'sex-diff-windows',
    title: 'Sensitive windows differ by sex',
    body:
      'A study of 84,011 UK teens found social use predicted lower life-satisfaction a year later only in narrow windows: girls ~11–13, boys ~14–15. If you tighten anything, tighten it most during your kid’s window.',
    ages: ['10-13', '14-16'],
    tags: ['sex-diff'],
    source: 'Orben, Przybylski, Blakemore et al. 2022, Nature Communications',
    url: 'https://www.nature.com/articles/s41467-022-29296-3',
  },
  {
    id: 'between-person-variance',
    title: 'Your kid is not the average kid',
    body:
      'A 7-day daily-diary study found ~44% of teens showed no mood effect from screen use, ~10% clearly negative, ~46% slightly positive. Watch how your kid actually acts after a session — wired and irritable, or fine — not the headline average.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['general'],
    source: 'Beyens et al. 2020, Scientific Reports',
    url: 'https://www.nature.com/articles/s41598-020-67727-7',
  },

  // ── ADHD / Autism ────────────────────────────────────────
  {
    id: 'adhd-screens',
    title: 'ADHD + screens: small, bidirectional link',
    body:
      'In 2,587 LA teens followed 2 years, each extra high-frequency media activity raised ADHD-symptom odds 10%. Meta-analytic effects are modest (r≈0.12) and go both ways. Quality and routine matter more than the raw number for these kids.',
    ages: ['10-13', '14-16'],
    tags: ['adhd'],
    source: 'Ra et al. 2018, JAMA · Nikkelen et al. 2014',
    url: 'https://jamanetwork.com/journals/jama/fullarticle/2687861',
  },
  {
    id: 'autism-co-use',
    title: 'For autistic kids, structured use is the win',
    body:
      'Video modeling is an evidence-based teaching tool (PND ~89% for functional skills). Distinguish therapeutic / communication-aid screen use from recreational — limits should apply to the latter.',
    ages: ['6-9', '10-13', '14-16'],
    tags: ['autism'],
    source: 'Bellini & Akullian 2007, Exceptional Children',
    url: 'https://journals.sagepub.com/doi/10.1177/001440290707300301',
  },

  // ── Age 6–9: routines, countdowns, co-play ───────────────
  {
    id: 'young-countdowns',
    title: '6–9: countdowns, not cut-offs',
    body:
      'Under-10s have little time-sense and almost no impulse brake yet. A visible “10 minutes left → 5 → 2, save your game” sequence prevents the meltdown that a sudden lock causes. The agent’s warnings are built for exactly this.',
    ages: ['6-9'],
    tags: ['gaming', 'schedule', 'general'],
    source: 'Executive-function development · Best & Miller 2010',
  },
  {
    id: 'young-same-time',
    title: '6–9: same time every day beats a minutes budget',
    body:
      'Young kids follow rhythms, not allowances. “PC after homework until dinner” is easier to keep than “90 minutes somewhere today”. Predictability lowers the daily negotiation and the fights.',
    ages: ['6-9'],
    tags: ['schedule', 'daily-limit'],
    source: 'Routine-based mediation · AAP Family Media Plan',
  },

  // ── Age 10–13: homework displacement, negotiation ────────
  {
    id: 'tween-displacement',
    title: '10–13: protect sleep and homework first',
    body:
      'At this age the harm signal isn’t hours of gaming — it’s what the gaming pushes out. Lock the schedule around homework and bedtime and let the rest be flexible. Kids who help set the rule break it less.',
    ages: ['10-13'],
    tags: ['schedule', 'bedtime', 'general'],
    source: 'Steinberg et al. 1994 · displacement hypothesis',
  },
  {
    id: 'tween-negotiate',
    title: '10–13: negotiate the number together',
    body:
      'This is the age to move from “my rule” to “our rule”. Co-set the daily limit and the request flow. The kid-side dashboard (their bank, their request button) is the tool that makes the negotiation real instead of theoretical.',
    ages: ['10-13'],
    tags: ['requests', 'bank', 'general'],
    source: 'Van Petegem et al. 2015 (co-constructed rules reduce defiance)',
  },

  // ── Age 14–16: hand off self-regulation ──────────────────
  {
    id: 'teen-handoff',
    title: '14–16: start handing the controls over',
    body:
      'The goal by 16 is a kid who self-regulates, not one who’s externally policed. Loosen caps as they demonstrate it; keep transparency and the conversation. Surveillance that tightens with age predicts more sneaking, not less.',
    ages: ['14-16'],
    tags: ['general', 'requests'],
    source: 'Stattin & Kerr 2000 · self-determination theory',
  },
  {
    id: 'teen-late-night',
    title: '14–16: the real fight is late-night gaming',
    body:
      'Teens’ body clocks shift later, and ranked play peaks at night. A consistent PC-off-by bedtime protects more wellbeing than any daytime cap — sleep is the single biggest lever at this age.',
    ages: ['14-16'],
    tags: ['bedtime', 'sleep', 'gaming'],
    source: 'Paruthi et al. 2016 · adolescent sleep-phase delay',
  },
];

// ─── Verbatim conversation scripts ────────────────────────
export const SCRIPTS: ConversationScript[] = [
  {
    id: 'cps-bedtime',
    scenario: 'Stopping at bedtime is a fight',
    ages: ['6-9', '10-13', '14-16'],
    approach: 'Collaborative & Proactive Solutions (Greene)',
    say: [
      '“I’ve noticed it’s really hard to stop the game when I say it’s time. What’s up?” *(then listen — drill in with “What else?” until the real concern surfaces, e.g. “if I leave mid-match I let my squad down”).*',
      '“My concern is that when you stop at 10, you can’t fall asleep and you’re a zombie at school.”',
      '“I wonder if there’s a way you don’t bail on your squad *and* you still get to sleep on time. Got any ideas?”',
    ],
    source: 'Greene et al. 2004 RCT, JCCP',
    url: 'https://livesinthebalance.org/wp-content/uploads/2021/06/Greene-JCCP-2004.pdf',
  },
  {
    id: 'mi-teen',
    scenario: 'Teen says limits are unfair',
    ages: ['14-16'],
    approach: 'Motivational Interviewing',
    say: [
      '“What do you like about how you’re using your phone right now — and what, if anything, bugs you about it?” *(open question + evocation, don’t argue)*',
      '“So part of you feels the limits are unfair, and another part has noticed you feel kind of crap after a long TikTok session. Did I get that right?” *(reflection)*',
      '“It took guts to be straight with me about that. Thanks.” *(affirmation)*',
    ],
    source: 'Naar-King & Suarez 2011',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3917675/',
  },
  {
    id: 'authoritative-rule',
    scenario: 'Setting a rule without picking a fight',
    ages: ['10-13', '14-16'],
    approach: 'Authoritative (warmth + firm structure)',
    say: [
      '“I love hanging out with you — and the phone goes on the kitchen counter at 9 so we can actually talk.” *(warmth + limit, said in one breath)*',
      '“The rule is one hour of games on school nights. I know you disagree. The rule stands; let’s talk about weekends.” *(demanding, respectful, no guilt-trip)*',
    ],
    source: 'Steinberg et al. 1994, Child Development',
    url: 'https://pubmed.ncbi.nlm.nih.gov/8045165/',
  },
  {
    id: 'no-snooping',
    scenario: 'Your teen suspects you’re checking up on them',
    ages: ['14-16'],
    approach: 'Disclosure over surveillance (Kerr & Stattin)',
    say: [
      '“I use the parent app to see how much time you’re on, not to read your messages.”',
      '“If something feels off, I’d rather you tell me than have me guess from data. What’s a fair way to handle it?”',
    ],
    source: 'Kerr & Stattin 2000, Developmental Psychology',
    url: 'https://pubmed.ncbi.nlm.nih.gov/10830980/',
  },
  {
    id: 'family-meeting',
    scenario: 'Weekly family check-in',
    ages: ['6-9', '10-13', '14-16'],
    approach: 'Family Check-Up (Stormshak RCT)',
    say: [
      'Set a 15-minute slot, same time each week. Three rounds:',
      '1. **Appreciations** — each person names one thing the others did well.',
      '2. **One thing working / one thing not.**',
      '3. **One decision to make together** (e.g. weekend screen rule).',
      'The RCT effect is on listening + problem-solving — not on the document.',
    ],
    source: 'Stormshak et al. 2011 RCT, n≈593 families',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4873463/',
  },
  {
    id: 'gaming-disorder-talk',
    scenario: 'You’re worried about gaming addiction',
    ages: ['10-13', '14-16'],
    approach: 'Frame around impairment, not hours',
    say: [
      'Watch for: lying about play time, irritability when not playing, declining sleep/grades, loss of other interests, skipping meals. *Hours alone don’t qualify under WHO ICD-11 6C51.*',
      'Open with worry, not accusation: “I’ve been worrying about how much you’re missing sleep / dropping the football team. I’d like to figure it out *with* you.”',
    ],
    source: 'WHO ICD-11 Gaming Disorder · Petry et al. 2014',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/add.12457',
  },
];

// ─── Reading list ────────────────────────────────────────
export const READING: Reading[] = [
  {
    id: 'aap-policy',
    title: 'AAP Media Use in School-Aged Children and Adolescents',
    citation: 'AAP Council on Communications and Media, Pediatrics, 2016',
    url: 'https://publications.aap.org/pediatrics/article/138/5/e20162592',
    blurb: 'The policy statement that abandoned the “2-hour rule” for ages 5–18 in favour of a Family Media Plan.',
  },
  {
    id: 'aap-family-media-plan',
    title: 'AAP Family Media Plan tool',
    citation: 'healthychildren.org / AAP',
    url: 'https://www.healthychildren.org/English/family-life/Media/Pages/helping-kids-thrive-in-a-digital-world-AAP-policy-explained.aspx',
    blurb: 'Build a household plan covering bedrooms, mealtimes, the hour before bed, content choice and communication.',
  },
  {
    id: 'orben-przybylski',
    title: 'The association between adolescent well-being and digital technology use',
    citation: 'Orben & Przybylski 2019, Nature Human Behaviour',
    url: 'https://www.nature.com/articles/s41562-018-0506-1',
    blurb: 'The 0.4%-of-variance / “potato” paper. Why the headline-grabbing screen-time effect is tiny on average.',
  },
  {
    id: 'carter-meta',
    title: 'Portable media in the bedroom and sleep (meta-analysis)',
    citation: 'Carter et al. 2016, JAMA Pediatrics, n=125,198',
    url: 'https://jamanetwork.com/journals/jamapediatrics/fullarticle/2571467',
    blurb: 'The strongest single finding in this whole literature: device presence in the bedroom raised inadequate-sleep odds 79%, even when not used.',
  },
  {
    id: 'orben-windows',
    title: 'Windows of developmental sensitivity to social media',
    citation: 'Orben, Przybylski, Blakemore et al. 2022, Nature Communications, n=84,011',
    url: 'https://www.nature.com/articles/s41467-022-29296-3',
    blurb: 'Why “teens” isn’t one group: girls 11–13 and boys 14–15 are the sensitive windows.',
  },
  {
    id: 'pickard-rct',
    title: 'PASTI trial: a screen-free hour before bed (RCT)',
    citation: 'Pickard et al. 2024, JAMA Pediatrics',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11581737/',
    blurb: 'The only RCT directly testing a pre-bed screen cutoff. d=0.56 on sleep efficiency; no effect on total duration.',
  },
  {
    id: 'cochrane-blue',
    title: 'Cochrane review: blue-light filtering glasses',
    citation: 'Singh et al. 2023, Cochrane Database',
    url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD013244.pub2/full',
    blurb: '17 RCTs, n=619: no clear benefit for eye strain, sleep or eye health. AAO does not recommend them.',
  },
  {
    id: 'greene-cps',
    title: 'Collaborative & Proactive Solutions for ODD (RCT)',
    citation: 'Greene et al. 2004, JCCP',
    url: 'https://livesinthebalance.org/wp-content/uploads/2021/06/Greene-JCCP-2004.pdf',
    blurb: '“Kids do well if they can.” Equally effective as standard parent training, less resentment.',
  },
  {
    id: 'who-icd11-gaming',
    title: 'WHO ICD-11 Gaming Disorder (6C51)',
    citation: 'WHO ICD-11 / Petry et al. 2014, Addiction',
    url: 'https://onlinelibrary.wiley.com/doi/10.1111/add.12457',
    blurb: 'The diagnostic standard. Impairment of life functioning, not raw hours, is the criterion.',
  },
  {
    id: 'commonsense-census',
    title: 'Common Sense Census: Media Use by Tweens and Teens',
    citation: 'Common Sense Media 2021, US, n=1,306',
    url: 'https://www.commonsensemedia.org/research/the-common-sense-census-media-use-by-tweens-and-teens-2021',
    blurb: 'Benchmark for what kids actually do: tweens 5h33m/day, teens 8h39m/day of entertainment screen time.',
  },
];

export const ANTI_PATTERNS: { title: string; body: string }[] = [
  { title: 'Snooping without conversation', body: 'Tracking apps used as surveillance predict less child disclosure, not safer behaviour.' },
  { title: 'Pure punishment after the fact', body: 'Removing the device after a violation, without a clear advance rule, trains sneaking — not self-control.' },
  { title: 'Comparing siblings or peers', body: '“Your brother doesn’t have this problem” reliably damages relationship and motivation. Frame around the kid’s own goals.' },
  { title: 'Threatening what you’ll cave on', body: 'Saying “five more minutes” then folding under whining teaches escalation — the coercive cycle (Patterson 1982).' },
  { title: 'Hard ban on specific apps for teens', body: 'Reactance/forbidden-fruit effect can increase desire. Reserve hard blocks for genuinely harmful content and explain why.' },
  { title: 'Cold-turkey removal of a game', body: 'Triggers craving and irritability in the first 24–72 hours. Gradually reduce and substitute, especially for heavy users.' },
];

/** Pick tips for a given tag + age. Returns up to `limit` items. */
export function tipsFor(tag: TipTag, age: AgeBand | undefined, limit = 3): Tip[] {
  return WISDOM.filter((t) => t.tags.includes(tag))
    .filter((t) => !age || t.ages.length === 0 || t.ages.includes(age))
    .slice(0, limit);
}

// ─── Behaviour-driven insights ─────────────────────────────
// These look at the data we already collect (usage history, schedules,
// blocklist, recent activity) and surface contextual cards.

export interface Insight {
  id: string;
  severity: 'info' | 'success' | 'warning';
  icon: string; // Ionicons name
  title: string;
  body: string;
  source?: string;
}

interface DayPoint {
  date: string;
  totalMinutes: number;
  appUsage?: Record<string, number>;
}

export interface InsightInputs {
  device: Device;
  // Last N days of daily totals + per-app minutes (oldest first).
  history?: DayPoint[];
  // Approximate count of recent denied time-requests (set by caller).
  recentDeniedRequests?: number;
  // Approximate count of recent tamper/agent-offline events.
  recentTamperEvents?: number;
  // Whether the user has any enabled schedule for this device.
  hasSchedule?: boolean;
  // Recent time requests (pending + resolved), oldest first.
  recentRequests?: { minutes: number; createdAt: number; status: string }[];
  // Per-device executive-function / ND mode toggle.
  nd?: boolean;
}

export function computeInsights(input: InsightInputs): Insight[] {
  const { device, history = [], recentDeniedRequests = 0, recentTamperEvents = 0, hasSchedule, recentRequests = [], nd } = input;
  const out: Insight[] = [];

  // Repeated late requests at similar time = bedtime is set wrong, not a
  // discipline problem. Coyne 2023: one negotiated late night per week
  // reduces conflict without raising average use.
  if (recentRequests.length >= 3) {
    const last7 = recentRequests.filter((r) => Date.now() - r.createdAt < 7 * 86400_000);
    const lateHours = last7
      .map((r) => new Date(r.createdAt).getHours())
      .filter((h) => h >= 20 && h <= 23);
    if (lateHours.length >= 3) {
      out.push({
        id: 'bedtime-pattern',
        severity: 'info',
        icon: 'moon-outline',
        title: 'Your kid asks for more time at bedtime, often',
        body:
          'Three+ late requests this week. One negotiated extension per week (e.g., Fridays +30) tends to reduce nightly conflict without raising weekly use.',
        source: 'Coyne et al. 2023',
      });
    }
  }

  // ND mode active: surface executive-function-aware framing.
  if (nd) {
    out.push({
      id: 'nd-mode',
      severity: 'info',
      icon: 'flash-outline',
      title: 'Executive-function support is on',
      body:
        'Warmer transition warnings, longer no-surprise grace, and ND-tagged tips appear in Wisdom. Kids with ADHD/ASD respond worse to abrupt lockouts and better to predictable countdowns.',
      source: 'Barkley 2015 · CHADD',
    });
  }

  // Streaks under-limit.
  if (device.dailyLimitMinutes > 0 && history.length >= 5) {
    const last5 = history.slice(-5);
    const under = last5.every((d) => d.totalMinutes <= device.dailyLimitMinutes);
    if (under) {
      out.push({
        id: 'streak-good',
        severity: 'success',
        icon: 'trophy-outline',
        title: 'Five days under the limit',
        body:
          'Quietly notice this with a warm comment — unexpected verbal praise reinforces self-control without the overjustification trap.',
        source: 'Deci, Koestner & Ryan 1999',
      });
    }
  }

  // Chronic over-limit.
  if (device.dailyLimitMinutes > 0 && history.length >= 5) {
    const last7 = history.slice(-7);
    const overDays = last7.filter((d) => d.totalMinutes > device.dailyLimitMinutes).length;
    if (overDays >= 5) {
      out.push({
        id: 'cap-fires-often',
        severity: 'warning',
        icon: 'alert-circle-outline',
        title: 'The cap is hitting almost every day',
        body:
          'When a limit fires constantly, kids start sneaking. Renegotiate the number with them — kids who help set the rule follow it better.',
        source: 'Steinberg et al. 1994',
      });
    }
  }

  // One app dominates.
  if (history.length > 0) {
    const today = history[history.length - 1];
    const apps = today.appUsage || {};
    const entries = Object.entries(apps).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, m]) => s + m, 0);
    if (entries.length > 0 && total > 30) {
      const [name, mins] = entries[0];
      if (mins / total >= 0.6) {
        const looksLikeGame = /steam|fortnite|roblox|minecraft|epic|league|cs|game/i.test(name);
        out.push({
          id: 'app-dominates',
          severity: 'info',
          icon: 'pie-chart-outline',
          title: `${name} is ${Math.round((mins / total) * 100)}% of today`,
          body: looksLikeGame
            ? 'Consider co-playing one session this week. Joint media engagement transfers learning and beats restriction-only mediation.'
            : 'Heavy use of one app isn’t inherently bad — context and content matter more than minutes. Ask what they get out of it.',
          source: 'Takeuchi & Stevens 2011 (joint media engagement)',
        });
      }
    }
  }

  // No bedtime schedule.
  if (hasSchedule === false) {
    out.push({
      id: 'no-bedtime',
      severity: 'info',
      icon: 'bed-outline',
      title: 'No bedtime schedule set',
      body:
        'A consistent wind-down (≥5 nights/week) reliably improves sleep onset — more than the daily total for kids under 10. Try the Bedtime preset.',
      source: 'Mindell et al. 2009/2015, Sleep',
    });
  }

  // Same app blocked repeatedly + age likely teen → reactance.
  if (device.blocklist && device.blocklist.length >= 1) {
    out.push({
      id: 'reactance',
      severity: 'info',
      icon: 'shield-outline',
      title: 'Hard blocks work best with a conversation',
      body:
        'For ages ~11+, blocking a specific app can make it more desirable. Pair the block with a brief why — restriction + dialogue beats restriction alone.',
      source: 'Nathanson 2002 · Bijvank et al. 2009',
    });
  }

  // Many denials → conflict risk.
  if (recentDeniedRequests >= 3) {
    out.push({
      id: 'many-denials',
      severity: 'warning',
      icon: 'chatbox-ellipses-outline',
      title: `${recentDeniedRequests} time-requests denied recently`,
      body:
        'Try the “two-question” opener: “What makes stopping hard right now?” → listen, then “Here’s my concern.” Equivalent to standard training, less resentment.',
      source: 'Greene et al. 2004, JCCP',
    });
  }

  // Tampering signals.
  if (recentTamperEvents >= 2) {
    out.push({
      id: 'tamper',
      severity: 'warning',
      icon: 'eye-off-outline',
      title: 'Repeated offline events',
      body:
        'Surveillance without conversation predicts less disclosure — and savvy kids will keep finding workarounds. A short, direct talk does more than tightening the tech.',
      source: 'Kerr & Stattin 2000',
    });
  }

  // Bedroom device hint (we can’t detect placement, but always relevant).
  if (device.dailyLimitMinutes > 0 && out.length < 3) {
    out.push({
      id: 'bedroom-hint',
      severity: 'info',
      icon: 'bed-outline',
      title: 'Where does this device live at night?',
      body:
        'Device presence in the bedroom raised the odds of inadequate sleep by 79% in a 125k-kid meta — even when not used. A charging spot in the kitchen is a cheap win.',
      source: 'Carter et al. 2016, JAMA Pediatrics',
    });
  }

  return out.slice(0, 4);
}
