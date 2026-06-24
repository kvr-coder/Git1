// Map raw Windows executable names (what the agent reports) to friendly,
// parent-readable app names for the Stats screen. Display-only — the stored
// data stays the raw exe name. Easy to extend; ships via OTA.

// Exact matches on the normalized name (lowercased, no ".exe").
const EXACT: Record<string, string> = {
  // Browsers
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  brave: 'Brave',
  opera: 'Opera',
  // Chat / social
  discord: 'Discord',
  slack: 'Slack',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  zoom: 'Zoom',
  // Games / launchers
  steam: 'Steam',
  javaw: 'Minecraft (Java)',
  minecraft: 'Minecraft',
  minecraftlauncher: 'Minecraft Launcher',
  epicgameslauncher: 'Epic Games Launcher',
  battlenet: 'Battle.net',
  gta5: 'GTA V',
  // Media / creative
  spotify: 'Spotify',
  vlc: 'VLC',
  obs64: 'OBS Studio',
  obs: 'OBS Studio',
  // Productivity
  code: 'Visual Studio Code',
  winword: 'Microsoft Word',
  excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  outlook: 'Outlook',
  onenote: 'OneNote',
  notepad: 'Notepad',
  // Windows shell (usually filtered, but just in case)
  explorer: 'File Explorer',
};

// Substring matches for messy names (version suffixes, reverse-DNS, *-Shipping).
const CONTAINS: [string, string][] = [
  ['satisfactory', 'Satisfactory'],
  ['factorygame', 'Satisfactory'],
  ['godot', 'Godot Engine'],
  ['robloxplayer', 'Roblox'],
  ['roblox', 'Roblox'],
  ['moonsworth', 'Lunar Client'],
  ['lunar', 'Lunar Client'],
  ['valorant', 'Valorant'],
  ['fortnite', 'Fortnite'],
  ['leagueclient', 'League of Legends'],
  ['minecraft', 'Minecraft'],
  ['ms-teams', 'Microsoft Teams'],
  ['teams', 'Microsoft Teams'],
  ['chrome', 'Google Chrome'],
  ['discord', 'Discord'],
  ['steam', 'Steam'],
];

export function friendlyAppName(raw: string): string {
  const n = (raw || '').toLowerCase().replace(/\.exe$/i, '').trim();
  if (!n) return raw;
  if (EXACT[n]) return EXACT[n];
  for (const [frag, name] of CONTAINS) {
    if (n.includes(frag)) return name;
  }
  // Unknown: return the raw exe (minus .exe) so the parent still sees something
  // real rather than a guess.
  return raw.replace(/\.exe$/i, '');
}
