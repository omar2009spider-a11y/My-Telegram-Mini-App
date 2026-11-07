# Neon Nibbler

A mobile-first, one-thumb arcade game prototype designed to open inside Telegram. There are no build steps or dependencies: the game is a static HTML, CSS and JavaScript app.

## Run locally

Serve this folder over HTTP with any static file server and open the address on a phone or desktop browser. For example, from this folder:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Play and progression

- Choose **Classic** (balanced 30-second run), **Zen** (60 seconds, no comets), or **Rush** (fast 25-second run with a reward bonus).
- Slide or tap across the play field to move Nibbler. Catch glowing stars and berries; consecutive catches raise your combo. Comets cost points unless a shield blocks the hit.
- Use **Star Burst** to clear visible fruit for double points. Combo Core upgrades add boost charges and raise the score multiplier; Star Magnet widens the catch zone; Comet Shield blocks hits.
- Earn game stars and XP from runs, daily missions, daily chests, and achievements. Spend stars on upgrades and five mascot looks.
- Open **Settings** to choose music, sound effects, haptics, reduced motion, left-handed controls, default run mode, difficulty, and your display name.
- Scores, settings, streaks, upgrades, and collections save in this browser using local storage.

## Telegram Mini App setup

1. Host the contents of this folder on an HTTPS static host.
2. Create a bot with Telegram's BotFather and set its Mini App URL to the hosted `index.html` URL.
3. Open it from the bot's menu button or a Mini App link. The Telegram Web App SDK is loaded by `index.html`; the app calls `ready()`, `expand()`, and haptic feedback when available.

This is a feature-rich single-player prototype. It does not validate Telegram `initData`, synchronize progress, provide a real multiplayer leaderboard, issue server-verified referrals, or process payments. Before public launch, add a trusted server that validates `initData`, stores player state, rate-limits score submissions, and owns any payment or reward logic. Local scores are easy to edit and must not be used to award cash or valuable prizes.

The leaderboard names on the home screen are illustrative demo entries. The interface does not claim guaranteed income or cash payouts. Revenue depends on audience, retention, distribution, and a properly implemented business model; none is guaranteed by this prototype.
