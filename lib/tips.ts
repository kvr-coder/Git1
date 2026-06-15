import { Ionicons } from '@expo/vector-icons';

export type TipCategory = 'focus' | 'habits' | 'screentime' | 'energy';

export interface Tip {
  id: string;
  category: TipCategory;
  title: string;
  body: string;
}

export const categoryMeta: Record<
  TipCategory,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  focus: { label: 'Focus', icon: 'flag' },
  habits: { label: 'Habits', icon: 'repeat' },
  screentime: { label: 'Screen time', icon: 'phone-portrait' },
  energy: { label: 'Energy', icon: 'flash' },
};

export const tips: Tip[] = [
  {
    id: 'pomodoro',
    category: 'focus',
    title: 'Work in 25-minute sprints',
    body: 'Pick one task, set a 25-minute timer, and work only on that until it rings. Then take a 5-minute break. Short, bounded sprints make starting easier and keep attention from drifting.',
  },
  {
    id: 'single-task',
    category: 'focus',
    title: 'Do one thing at a time',
    body: 'Multitasking feels productive but switching costs add up. Close other tabs, silence notifications, and finish the current task before reaching for the next.',
  },
  {
    id: 'two-minute',
    category: 'habits',
    title: 'Use the two-minute rule',
    body: 'If something takes less than two minutes — replying, tidying, filing — do it now instead of adding it to a list. It clears small tasks before they pile up.',
  },
  {
    id: 'frog',
    category: 'focus',
    title: 'Eat the frog first',
    body: 'Tackle your hardest or most-dreaded task first thing, while your energy and willpower are highest. Everything after it feels lighter.',
  },
  {
    id: 'plan-night-before',
    category: 'habits',
    title: 'Plan tomorrow the night before',
    body: 'Spend five minutes each evening writing your top three tasks for the next day. You start the morning knowing exactly what matters instead of deciding on the fly.',
  },
  {
    id: 'phone-away',
    category: 'screentime',
    title: 'Keep your phone in another room',
    body: 'Out of sight really is out of mind. When you need to concentrate, put your phone somewhere you have to stand up to reach it.',
  },
  {
    id: 'grayscale',
    category: 'screentime',
    title: 'Turn your screen grayscale',
    body: 'Colorful icons and notifications are designed to pull you in. Switching to grayscale makes apps far less tempting and easier to put down.',
  },
  {
    id: 'screen-free-meals',
    category: 'screentime',
    title: 'Make meals screen-free',
    body: 'Set a simple family rule: no devices at the table. It protects time for real conversation and gives everyone a regular break from screens.',
  },
  {
    id: 'breaks',
    category: 'energy',
    title: 'Take real breaks',
    body: 'Step away from the screen every hour — stretch, drink water, look out a window. Short movement breaks restore focus far better than scrolling.',
  },
  {
    id: 'sleep',
    category: 'energy',
    title: 'Protect your sleep',
    body: 'Productivity starts the night before. Aim for a consistent bedtime and stop screens 30–60 minutes before sleep so your brain can wind down.',
  },
  {
    id: 'tiny-habits',
    category: 'habits',
    title: 'Start habits absurdly small',
    body: 'Want to read more? Start with one page. Want to tidy? Start with one shelf. Tiny, repeatable starts build momentum that willpower alone cannot.',
  },
  {
    id: 'celebrate-wins',
    category: 'habits',
    title: 'Track and celebrate small wins',
    body: 'Check off completed tasks and notice progress. Acknowledging finished work — even chores — reinforces the habit and keeps motivation up.',
  },
];

/**
 * Returns a deterministic "tip of the day" so the same tip shows for the whole
 * day and rotates predictably. Based on days since the Unix epoch.
 */
export function tipOfTheDay(now: Date = new Date()): Tip {
  const dayIndex = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return tips[dayIndex % tips.length];
}
