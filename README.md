# 🏏 PitchSide — Live Cricket Scorer

A single-file, mobile-first cricket scoring app. Set your teams, toss the
coin, and score the match ball-by-ball — dots, boundaries, wickets, wides,
no balls, free hits, run outs, retired hurt — with live CRR/RRR, a target
chase, and a full match result. No backend, no build step, no dependencies
beyond two Google Fonts.

### **[🚀 ▶ Live Mode ](https://getparvezgit.github.io/pitchside-live-cricket-scorer/)**

![PitchSide preview](https://img.shields.io/badge/type-%20HTML%20app-blue) ![No build step](https://img.shields.io/badge/build-none-brightgreen) ![Mobile first](https://img.shields.io/badge/design-mobile--first-orange)

---

## ✨ Features

- **Match setup** — team names, overs, and wicket limit, with quick-select
  chips for common formats (T5 / 10-over / T20 / ODI)
- **Coin toss** — a real 3D-flipping coin animation, then bat/bowl choice
  for the toss winner
- **Ball-by-ball scoring** — Dot, 1–6 runs, Wicket, Wide, No Ball, Run Out,
  Retired Hurt, all in one tap-friendly grid
- **Free Hit handling** — a No Ball automatically grants the next
  delivery(ies) a Free Hit, shown with a pulsing banner. On a No Ball or an
  active Free Hit, "Wicket" is always tappable but never dismisses the
  batter (it's silently scored as a dot) — **only Run Out counts**, exactly
  like the real rule. The Free Hit correctly survives through any wides
  bowled in between.
- **Live match stats** — current run rate (CRR), required run rate (RRR),
  and a plain-English "need X runs from Y balls" line during the chase
- **Automatic innings/match end** — handles all-out, overs-completed, a
  chase won mid-over, and tied matches, with a proper result screen
- **Scoreboard** — full over-by-over ball history for the current innings
  (and a summary of the first innings once you're chasing)
- **Light / dark mode** — a toggle in the top corner switches between a
  floodlit-dusk stadium and a bright daytime one; defaults to your device's
  system preference
- **Built for mobile** — tap targets sized for thumbs, tested down to a
  320px-wide screen, safe-area padding for notched phones

## 🚀 Quick start

Nothing to install. Open `index.html` in any browser, or host it for free
in under two minutes:

### Deployed with GitHub Pages

1. Create a new repository (see [naming suggestion](#repo-name) below) and
   add `index.html` to the **root**.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose `Deploy from a branch`.
4. **Branch**: `main`, folder `/ (root)` → **Save**.
5. Wait about a minute, then refresh — GitHub gives you a live URL:
   `https://<your-username>.github.io/<repo-name>/`

Open that on your phone and (optionally) "Add to Home Screen" for a
full-screen, app-like feel.

### Run it locally

No server required — just open the file:

```bash
git clone https://github.com/<your-username>/pitchside-scorer.git
cd pitchside-scorer
open index.html   # or double-click it, or drag it into a browser tab
```

## 🏗 How it's built

Everything — HTML, CSS, and JavaScript

- **Fonts**: [Big Shoulders Display](https://fonts.google.com/specimen/Big+Shoulders+Display)
  for scoreboard digits, [Manrope](https://fonts.google.com/specimen/Manrope)
  for UI text, [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
  for stat labels and ball-by-ball chips — all loaded from Google Fonts.
- **Styling**: plain CSS with custom properties driving both themes — the
  entire light/dark palette (including the ambient stadium background) is
  defined as a set of variables, so the component styles never hardcode a
  color.
- **State**: kept in memory only (a single JS object), reset on page
  refresh by design. If you want it to survive a reload, add
  `localStorage` calls around the `state` object — it isn't included on
  purpose, to keep the file dependency-free and predictable.
- **No images**: the stadium backdrop is pure CSS (gradients + blur), so
  there's no asset to host or optimize.

## 🏏 Scoring rules implemented

| Action | Counts as a legal ball? | Effect |
|---|---|---|
| Dot / 1–6 runs | Yes | Adds runs, advances the over |
| Wicket | Yes (unless No Ball / Free Hit) | Adds a wicket — but is scored as a dot if the ball is a No Ball or an active Free Hit |
| Wide | No | +1 run applied immediately; then optionally add more runs, a wicket, or a run out on that same ball |
| No Ball | No | +1 run applied immediately, grants the **next** delivery a Free Hit; same follow-up options as a Wide, but "Wicket" never counts here |
| Run Out | Yes | Prompts for runs completed before the dismissal, then adds the wicket — **always counts**, even on a No Ball, a Wide, or a Free Hit |
| Retired Hurt | No (doesn't use a ball) | Logged as an event and reduces the batting side's remaining "wickets in hand" tally |

The chase ends the instant the target is reached — even mid-over — exactly
like a real match. All-out or overs-completed decides the result the rest
of the time, with ties handled correctly.

## 📱 Browser support

Works in any modern mobile or desktop browser (Chrome, Safari, Firefox,
Edge). Uses standard CSS custom properties, `backdrop-filter`, and
`prefers-color-scheme` — no polyfills needed for anything released in the
last few years.

## 🤝 Contributing / customizing

It's one file, so it's easy to tweak:

- **Colors**: everything is in the `:root, [data-theme="dark"]` and
  `[data-theme="light"]` blocks near the top of the `<style>` tag.
- **Rules**: the scoring logic lives in clearly named functions
  (`doDot`, `doRuns`, `doWicket`, `startExtraBall`, `resolveRunOut`, etc.)
  in the `<script>` tag — each one is short and self-contained.

Pull requests and forks welcome.

## 📄 License

MIT — do whatever you like with it.
