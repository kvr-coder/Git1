# Git1 Roadmap

Living doc of feature ideas, ranked. Check off as shipped.

## Core gaps to close (table-stakes parity)
- [ ] **1. Android Accessibility-based app blocker** — kid-side hard block of apps (not just notify). The category-defining feature; enforcement is the moat.
- [ ] **2. Chore → screen-time auto-credit** — chores unlock minutes automatically on completion. The loop no competitor nails.
- [ ] **3. Photo check-ins** — kid sends selfie to prove location/activity. Reduces parent nagging.
- [ ] **4. Offline-first kid app** — limits + queued events work with no internet; sync on reconnect.
- [ ] **5. Pair-code recovery + multi-parent sync** — both parents share one dashboard; lost pair codes can be re-issued.
- [ ] **6. Geofencing + live location** — arrive/leave-school pings, background updates.
- [ ] Allowlist/blocklist per app per time-of-day ("Roblox only after homework, never after 9pm").
- [ ] Tamper-proofing — Device Admin uninstall protection, SIM-swap alert, GPS-off notification.

## Differentiators (post-MVP)
- [ ] AI conversation coach — Claude drafts 1-tap reply to time requests.
- [ ] Weekly "kid report" digest — Claude summary push/email every Sunday.
- [ ] Homework mode — one-tap blocks everything except learning apps for N minutes.
- [ ] Family calendar integration (Google Calendar sync, auto-relax on weekends).
- [ ] Sibling fairness view — side-by-side screen-time comparison.
- [ ] Driving detection — auto-DND + speed alert in cars.
- [ ] Open-source / no-data-sale trust angle in marketing.

## Currently in progress (this branch)
Working on 1, 2, 3, 4, 5, 6 — server + dashboard + kid-app scaffolding. Native app-blocker module requires a custom dev build to fully test.
