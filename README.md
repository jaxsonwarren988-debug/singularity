# Singularity OS

A browser-native desktop environment with:

- **Portal Browser** with a layered anti-filter proxy
  - CORS relay proxy (10 rotating relays)
  - **★ Stealth mode** — routes any site through `translate.google.com` so it loads even when Lightspeed, GoGuardian, Securly or other school filters block normal proxies
  - Auto-fallback: if all CORS relays fail, Portal transparently switches to Stealth
  - Built-in native YouTube and TikTok players (no ads, no tracking)
  - Reader mode (Jina AI reader + Wikipedia API)
  - Direct GitHub → jsDelivr CDN resolution for HTML5 game files
  - Backend switcher inside Stealth (Google Translate ↔ Wayback Machine)
- **KALMIA** agent AI (Nova-powered, with chat, notes vault, commands)
- **18 GPU shader wallpapers** (Black hole, Aurora, Matrix, Ocean, Snowfall, etc.)
- **Mesh networking** across tabs via BroadcastChannel
- **Tab cloaking** with 14 disguises (Classroom, Docs, Drive, Slides, Sheets, Gmail, Canvas, Schoology, Desmos, Khan Academy, IXL, Quizlet, Wikipedia, New Tab)
- **Panic screen** (`Shift+S`) that replaces the UI with a convincing Google Classroom dashboard
- Games, music player, AI, terminal, admin panel, themes

## Quick start

```bash
npm install
npm run dev       # start dev server at http://localhost:5173
npm run build     # produces a self-contained dist/index.html (~950 KB)
```

The `static-deploy/` folder contains the built single-file HTML ready to upload to
Static.app, Netlify, Vercel, Cloudflare Pages, GitHub Pages, or any static host.

## How Stealth mode works

When CORS relays are blocked (common on school networks), enabling **Stealth**
loads the target page inside Google Translate's web wrapper:

```
https://translate.google.com/translate?sl=auto&tl=en&u=<target URL>
```

Because Google Translate is a legitimate educational tool, nearly all school web
filters whitelist the `translate.google.com` domain. The result is proxied
through Google's servers and returned to the browser inside a frame. A second
backend (Wayback Machine) is available one click away if Translate is blocked.
