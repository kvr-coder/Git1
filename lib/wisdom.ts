// Evidence-based screen-time guidance, cited from peer-reviewed sources.
// Every tip is age-banded and tagged so we can surface the right ones to the
// right control. Citations are short — the full source URL is in `source`.

import type { Device } from './types';

export type AgeBand = '6-9' | '10-13' | '14-16';
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
  | 'social';

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

  // ── Social media / teen girls ────────────────────────────
  {
    id: 'sm-girls',
    title: 'Social media + appearance content: real, modest effect on girls',
    body:
      'Internal Meta research: 32% of teen girls said Instagram made body-image feelings worse. Effect sizes in academic studies are smaller and contested — but the appearance-comparison mechanism is well-replicated.',
    ages: ['10-13', '14-16'],
    tags: ['social'],
    source: 'Fardouly & Vartanian 2016 · WSJ Facebook Files 2021',
  },
  {
    id: 'passive-active',
    title: 'Passive scrolling hurts more than active use',
    body:
      'Lab + diary studies show scrolling-others’-posts predicts worse mood (mediated by envy). Posting, messaging, video chats don’t. If your teen needs social media, encourage the active kind.',
    ages: ['14-16'],
    tags: ['social'],
    source: 'Verduyn et al. 2015/2017 · Kross et al. 2013',
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
}

export function computeInsights(input: InsightInputs): Insight[] {
  const { device, history = [], recentDeniedRequests = 0, recentTamperEvents = 0, hasSchedule } = input;
  const out: Insight[] = [];

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
