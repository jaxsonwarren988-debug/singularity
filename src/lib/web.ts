/* Web routing helpers: platform-aware embeds, proxy relays and a curated directory.
 * Multi-layer strategy to defeat school filters like Lightspeed, GoGuardian, Securly, etc.
 * Chain order: CORS relays → Google Translate proxy → Wayback Machine → Jina Reader → Cloaked tab.
 */

export interface YTResult { id: string; title: string; author: string; thumb: string; duration?: string; views?: string }

/** Extracts a YouTube video / playlist / search intent from any YouTube-ish input. */
export function parseYouTube(input: string): { videoId?: string; listId?: string; query?: string } {
  const t = input.trim();
  try {
    const u = new URL(t.startsWith("http") ? t : "https://" + t);
    if (u.hostname.includes("youtu.be")) return { videoId: u.pathname.slice(1).split("/")[0] || undefined };
    if (u.hostname.includes("youtube")) {
      const v = u.searchParams.get("v");
      const list = u.searchParams.get("list");
      if (u.pathname.startsWith("/embed/")) return { videoId: u.pathname.split("/embed/")[1]?.split(/[/?]/)[0] };
      if (u.pathname.startsWith("/shorts/")) return { videoId: u.pathname.split("/shorts/")[1]?.split(/[/?]/)[0] };
      if (v) return { videoId: v, listId: list || undefined };
      if (u.pathname.startsWith("/playlist") && list) return { listId: list };
      const q = u.searchParams.get("search_query") || u.searchParams.get("q");
      if (q) return { query: q };
      if (u.pathname.startsWith("/results")) return { query: u.searchParams.get("search_query") || "" };
      return { query: "" };
    }
  } catch { /* not a URL */ }
  return { query: t.replace(/^(youtube|yt)\s*/i, "") };
}

export const ytEmbed = (id: string, list?: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1${list ? `&list=${list}` : ""}`;

export const ytPlaylistEmbed = (list: string) =>
  `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&autoplay=1`;

/** Searches YouTube through public Invidious/Piped mirrors (no API key needed). */
export async function searchYouTube(query: string): Promise<{ results: YTResult[]; source: string }> {
  const q = encodeURIComponent(query);
  const piped = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.private.coffee",
    "https://pipedapi.reallyaweso.me",
    "https://pipedapi.leptons.xyz",
    "https://pipedapi.drgns.space",
    "https://pipedapi.ducks.party",
  ];
  for (const base of piped) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6500);
      const r = await fetch(`${base}/search?q=${q}&filter=videos`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const j = await r.json();
      const items = (j?.items || []).filter((x: any) => x.url?.includes("watch?v="));
      if (!items.length) continue;
      return {
        source: new URL(base).hostname,
        results: items.slice(0, 18).map((x: any) => ({
          id: String(x.url).split("watch?v=")[1]?.split("&")[0] || "",
          title: x.title || "Untitled",
          author: x.uploaderName || "YouTube",
          thumb: (x.thumbnail || "").replace(/^http:/, "https:"),
          duration: x.duration > 0 ? `${Math.floor(x.duration / 60)}:${String(x.duration % 60).padStart(2, "0")}` : undefined,
          views: x.views > 0 ? `${Intl.NumberFormat("en", { notation: "compact" }).format(x.views)} views` : undefined,
        })).filter((x: YTResult) => x.id),
      };
    } catch { /* next mirror */ }
  }

  const invidious = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://inv.tux.pizza",
    "https://invidious.privacyredirect.com",
  ];
  for (const base of invidious) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 6500);
      const r = await fetch(`${base}/api/v1/search?q=${q}&type=video`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const j = await r.json();
      if (!Array.isArray(j) || !j.length) continue;
      return {
        source: new URL(base).hostname,
        results: j.slice(0, 18).map((x: any) => ({
          id: x.videoId,
          title: x.title,
          author: x.author || "YouTube",
          thumb: (x.videoThumbnails?.[3]?.url || x.videoThumbnails?.[0]?.url || "").replace(/^http:/, "https:"),
          duration: x.lengthSeconds ? `${Math.floor(x.lengthSeconds / 60)}:${String(x.lengthSeconds % 60).padStart(2, "0")}` : undefined,
          views: x.viewCount ? `${Intl.NumberFormat("en", { notation: "compact" }).format(x.viewCount)} views` : undefined,
        })).filter((x: YTResult) => x.id),
      };
    } catch { /* next mirror */ }
  }
  return { results: [], source: "" };
}

/** TikTok's official Player v1 iframe, documented for individual public posts. */
export function parseTikTok(input: string): { videoId?: string; user?: string } {
  const t = input.trim();
  const m = t.match(/tiktok\.com\/@([\w.-]+)\/video\/(\d+)/i);
  if (m) return { user: m[1], videoId: m[2] };
  const player = t.match(/tiktok\.com\/player\/v1\/(\d+)/i);
  if (player) return { videoId: player[1] };
  const embed = t.match(/tiktok\.com\/embed\/(\d+)/i);
  if (embed) return { videoId: embed[1] };
  const bare = t.match(/^\d{15,25}$/);
  if (bare) return { videoId: bare[0] };
  const u = t.match(/@([\w.-]+)/);
  return { user: u?.[1] };
}

export const tikTokEmbed = (id: string) =>
  `https://www.tiktok.com/player/v1/${encodeURIComponent(id)}?controls=1&description=1&music_info=1&rel=0`;

/** Turns a GitHub file/repo link into a CDN URL that serves real files with permissive headers. */
export function githubToCdn(input: string): { url: string; label: string } | null {
  const t = input.trim();
  const blob = t.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/blob\/([^/]+)\/(.+)/i);
  if (blob) {
    const [, user, repo, branch, path] = blob;
    return { url: `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`, label: "jsDelivr CDN" };
  }
  const raw = t.match(/raw\.githubusercontent\.com\/([\w.-]+)\/([\w.-]+)\/([^/]+)\/(.+)/i);
  if (raw) {
    const [, user, repo, branch, path] = raw;
    return { url: `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`, label: "jsDelivr CDN" };
  }
  const pages = t.match(/([\w-]+)\.github\.io\/([\w.-]+)?\/?(.*)/i);
  if (pages && !t.includes("github.com")) {
    return { url: t.startsWith("http") ? t : "https://" + t, label: "GitHub Pages" };
  }
  const repoOnly = t.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/i);
  if (repoOnly) {
    const [, user, repo] = repoOnly;
    return { url: `https://cdn.jsdelivr.net/gh/${user}/${repo}@main/index.html`, label: "jsDelivr · main/index.html" };
  }
  return null;
}

/* ==============================================================
 * STEALTH PROXY BACKENDS
 * These run on domains that Lightspeed and other school filters
 * almost universally allow (Google, Archive.org, Cloudflare CDN).
 * ============================================================== */

/** Returns Google Translate proxied URL - translate.google.com is almost never blocked. */
export function googleTranslateProxy(target: string, tl = "en"): string {
  return `https://translate.google.com/translate?sl=auto&tl=${tl}&u=${encodeURIComponent(target)}&_x_tr_hist=true`;
}

/** Returns Wayback Machine latest-snapshot proxy. Archive.org is usually allowed in schools. */
export function waybackProxy(target: string): string {
  return `https://web.archive.org/web/2/${encodeURI(target)}`;
}

/** Google AMP Cache - serves transformed pages through Google's CDN. */
export function googleAmpProxy(target: string): string | null {
  try {
    const u = new URL(target);
    const host = u.hostname;
    const path = u.pathname + u.search;
    return `https://cdn.ampproject.org/c/s/${host}${path.startsWith("/") ? "" : "/"}${path}`;
  } catch { return null; }
}

/** CORS relay list - expanded with many mirrors for redundancy. */
export interface Relay { name: string; fn: (target: string) => Promise<string>; }

export const CORS_RELAYS: Relay[] = [
  { name: "AllOrigins (raw)", fn: async (t) => { const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "AllOrigins (get)", fn: async (t) => { const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(t)}`); if (!r.ok) throw 0; const j = await r.json(); if (!j.contents) throw 0; return j.contents as string; } },
  { name: "CodeTabs", fn: async (t) => { const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(t)}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "CorsProxy.io", fn: async (t) => { const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(t)}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "Isomorphic", fn: async (t) => { const r = await fetch(`https://api.cors.lol/?url=${encodeURIComponent(t)}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "ThingProxy", fn: async (t) => { const r = await fetch(`https://thingproxy.freeboard.io/fetch/${t}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "CORS.Any", fn: async (t) => { const r = await fetch(`https://cors.any/${t}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "ProxyCors", fn: async (t) => { const r = await fetch(`https://proxy.cors.sh/${t}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "Deno CORS", fn: async (t) => { const r = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(t)}`); if (!r.ok) throw 0; return r.text(); } },
  { name: "Jina Reader (raw)", fn: async (t) => { const r = await fetch(`https://r.jina.ai/${t}`); if (!r.ok) throw 0; return r.text(); } },
];

/** Real public web-proxy front-ends that work when CORS relays are blocked.
 *  These are server-side proxies that fully rewrite URLs, handling logins. */
export const PROXY_ENGINES = [
  { name: "Rammerhead", url: "https://rammerhead.org/", note: "Session-based, best for logins", tint: "#ff9f45" },
  { name: "Ultraviolet (Titanium)", url: "https://titaniumnetwork.org/", note: "UV network hub & mirrors", tint: "#6ee7ff" },
  { name: "Interstellar", url: "https://gointerstellar.app/", note: "Games + proxy bundle", tint: "#c4b5fd" },
  { name: "Holy Unblocker", url: "https://holyubofficial.net/", note: "Long-running proxy suite", tint: "#9ef01a" },
  { name: "Space", url: "https://spaceofficial.msedge.net/", note: "Fast UV front-end", tint: "#ffd166" },
  { name: "Kazwire", url: "https://kazwire.com/", note: "Games, apps and proxy", tint: "#ff8fc4" },
  { name: "Doge Unblocker", url: "https://dogeub.github.io/", note: "Community mirror list", tint: "#2dd4bf" },
  { name: "Nebula", url: "https://nebulaproxy.io/", note: "Modern UV proxy", tint: "#c084fc" },
  { name: "Terbium", url: "https://terbium.cfd/", note: "Lightweight proxy", tint: "#fb7185" },
  { name: "Moonlight", url: "https://moonlightcc.vercel.app/", note: "Proxy + games", tint: "#38bdf8" },
  { name: "Google Translate", url: "https://translate.google.com/", note: "★ Unblockable: runs on Google's servers", tint: "#4ade80", builtin: "translate" as const },
  { name: "Wayback Machine", url: "https://web.archive.org/", note: "★ Unblockable: Internet Archive archive", tint: "#fbbf24", builtin: "wayback" as const },
];

export interface DirectoryEntry { name: string; url: string; cat: string; note: string; mode: "youtube" | "tiktok" | "proxy" | "direct" | "reader" | "github" | "stealth" }

/** Curated from TitaniumNetwork and community unblocked site lists. */
export const DIRECTORY: DirectoryEntry[] = [
  // video
  { name: "YouTube (native player)", url: "https://www.youtube.com", cat: "Video", note: "Search & play inside Portal's embed player", mode: "youtube" },
  { name: "YouTube Music", url: "https://music.youtube.com", cat: "Video", note: "Search tracks, play via embed", mode: "youtube" },
  { name: "Invidious", url: "https://yewtu.be", cat: "Video", note: "Privacy YouTube front-end", mode: "proxy" },
  { name: "Piped", url: "https://piped.video", cat: "Video", note: "Lightweight YouTube client", mode: "proxy" },
  { name: "TikTok (video player)", url: "https://www.tiktok.com", cat: "Video", note: "Paste any video link — embeds play", mode: "tiktok" },
  { name: "TikTok Discover", url: "https://www.tiktok.com/discover", cat: "Video", note: "Feed needs a full proxy or cloaked tab", mode: "tiktok" },
  { name: "Urlebird", url: "https://urlebird.com/", cat: "Video", note: "TikTok viewer that allows framing", mode: "proxy" },
  { name: "Twitch", url: "https://www.twitch.tv", cat: "Video", note: "Streams via proxy", mode: "proxy" },
  { name: "Netflix Watch Party", url: "https://www.netflix.com", cat: "Video", note: "Requires cloaked tab + login", mode: "proxy" },
  // games
  { name: "Poki", url: "https://poki.com/", cat: "Games", note: "Large HTML5 catalogue", mode: "proxy" },
  { name: "CrazyGames", url: "https://www.crazygames.com/", cat: "Games", note: "Modern browser titles", mode: "proxy" },
  { name: "Slope (mirror)", url: "https://slope.faav.top/", cat: "Games", note: "Classic 3D runner", mode: "direct" },
  { name: "Super Mario 64 WebGL", url: "https://28klotlucas2.github.io/Mario64webgl/", cat: "Games", note: "Full 3D port", mode: "direct" },
  { name: "Subway Surfers", url: "https://superteamxx.github.io/Subway-Surfers/", cat: "Games", note: "HTML5 build", mode: "direct" },
  { name: "FNF HTML5", url: "https://28klotlucas2.github.io/Funkin-Html5/", cat: "Games", note: "Rhythm battles", mode: "direct" },
  { name: "Hextris", url: "https://hextris.io/", cat: "Games", note: "Open-source hex puzzle", mode: "direct" },
  { name: "GBA Emulator", url: "https://cattn.github.io/gba/", cat: "Games", note: "Bring your own ROM", mode: "direct" },
  { name: "3kh0 Archive", url: "https://3kh0.net/", cat: "Games", note: "Rotating game archive", mode: "proxy" },
  { name: "Retro Bowl", url: "https://retrobowl.me/", cat: "Games", note: "Classic football sim", mode: "direct" },
  { name: "Among Us Freeplay", url: "https://amongusplay.online/", cat: "Games", note: "Web Among Us", mode: "proxy" },
  { name: "Minecraft Classic", url: "https://classic.minecraft.net/", cat: "Games", note: "Official browser Minecraft", mode: "direct" },
  { name: "Shell Shockers", url: "https://shellshock.io/", cat: "Games", note: "FPS egg shooter", mode: "proxy" },
  { name: "Railin Games", url: "https://railingames.github.io/index.html", cat: "Games", note: "Working mirror", mode: "direct" },
  { name: "SZ Games", url: "https://sz-games.github.io/", cat: "Games", note: "Working mirror", mode: "direct" },
  { name: "GameHub", url: "https://tylerpalko.github.io/gamehub/", cat: "Games", note: "Clean mini-game hub", mode: "direct" },
  { name: "Glatic Games", url: "https://realhack1.github.io/glaticgames/", cat: "Games", note: "Working mirror", mode: "direct" },
  { name: "Mountain Games", url: "https://mountain-game-games.github.io/", cat: "Games", note: "Community mirror", mode: "direct" },
  { name: "UBG9", url: "https://ubg9.github.io/", cat: "Games", note: "Community mirror", mode: "direct" },
  // social/chat
  { name: "Discord (browser)", url: "https://discord.com/app", cat: "Apps", note: "Use stealth proxy or Rammerhead", mode: "stealth" },
  { name: "Reddit", url: "https://old.reddit.com/", cat: "Apps", note: "Light, proxy-friendly", mode: "proxy" },
  { name: "X / Twitter", url: "https://x.com/", cat: "Apps", note: "Use Nitter mirror or stealth proxy", mode: "stealth" },
  { name: "Instagram", url: "https://www.instagram.com/", cat: "Apps", note: "Use stealth proxy or cloaked tab", mode: "stealth" },
  // apps / tools
  { name: "Desmos Graphing", url: "https://www.desmos.com/calculator", cat: "Apps", note: "Embeds perfectly", mode: "direct" },
  { name: "Photopea", url: "https://www.photopea.com/", cat: "Apps", note: "Photoshop in a tab", mode: "direct" },
  { name: "Gmail (stealth)", url: "https://mail.google.com", cat: "Apps", note: "Needs stealth proxy", mode: "stealth" },
  { name: "SoundCloud", url: "https://soundcloud.com/", cat: "Apps", note: "Music streaming", mode: "proxy" },
  { name: "Spotify Web", url: "https://open.spotify.com/", cat: "Apps", note: "Embeds playlists", mode: "direct" },
  { name: "Wikipedia", url: "https://en.wikipedia.org", cat: "Apps", note: "Instant reader mode", mode: "reader" },
  { name: "Internet Archive", url: "https://archive.org", cat: "Apps", note: "Books, audio, wayback", mode: "proxy" },
  { name: "Hacker News", url: "https://news.ycombinator.com", cat: "Apps", note: "Tech feed", mode: "proxy" },
  { name: "Project Gutenberg", url: "https://www.gutenberg.org", cat: "Apps", note: "70k free books", mode: "proxy" },
  { name: "Khan Academy", url: "https://www.khanacademy.org/", cat: "Apps", note: "Learning resources", mode: "direct" },
  { name: "Google Docs", url: "https://docs.google.com", cat: "Apps", note: "Use stealth proxy for login", mode: "stealth" },
  { name: "ChatGPT", url: "https://chatgpt.com", cat: "Apps", note: "Try stealth proxy", mode: "stealth" },
  // github game sources
  { name: "bns34/Unblocked-Sites", url: "https://github.com/bns34/Unblocked-Sites", cat: "GitHub", note: "The master unblocked list", mode: "reader" },
  { name: "Gabriel Cirulli · 2048", url: "https://gabrielecirulli.github.io/2048/", cat: "GitHub", note: "Original 2048 source", mode: "direct" },
  { name: "chvin · react-tetris", url: "https://chvin.github.io/react-tetris/", cat: "GitHub", note: "Handheld-style Tetris", mode: "direct" },
  { name: "wayou · t-rex-runner", url: "https://wayou.github.io/t-rex-runner/", cat: "GitHub", note: "Chrome dino, extracted", mode: "direct" },
  { name: "ellisonleao · clumsy-bird", url: "https://ellisonleao.github.io/clumsy-bird/", cat: "GitHub", note: "Open-source flappy", mode: "direct" },
  { name: "BinBashBanana · webretro", url: "https://binbashbanana.github.io/webretro/", cat: "GitHub", note: "RetroArch in the browser", mode: "direct" },
  { name: "TitaniumNetwork · Ultraviolet", url: "https://github.com/titaniumnetwork-dev/Ultraviolet", cat: "GitHub", note: "Deploy your own proxy", mode: "reader" },
];

export const DIR_CATS = ["All", "Video", "Games", "Apps", "GitHub"];

/** Hosts known to refuse framing — used to route users to a strategy that works. */
export const HARD_BLOCKERS = [
  "tiktok.com", "instagram.com", "facebook.com", "twitter.com", "x.com",
  "discord.com", "netflix.com", "google.com", "mail.google.com", "chatgpt.com",
  "openai.com", "roblox.com", "spotify.com",
];

export function blockerAdvice(url: string): { host: string; advice: string; alt?: string; useStealth?: boolean } | null {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  const hit = HARD_BLOCKERS.find((b) => host.endsWith(b));
  if (!hit) return null;
  const map: Record<string, { advice: string; alt?: string; useStealth?: boolean }> = {
    "tiktok.com": { advice: "TikTok blocks its feed from being framed. Individual videos DO embed — switch to TikTok mode and paste a video link.", alt: "https://urlebird.com/" },
    "instagram.com": { advice: "Instagram refuses framing. Try Stealth mode (uses Google Translate proxy) or a cloaked tab.", alt: "https://imginn.com/", useStealth: true },
    "discord.com": { advice: "Discord requires a server-side proxy. Try Stealth mode or open Rammerhead from the proxy engines list.", useStealth: true },
    "google.com": { advice: "Google sign-in cannot be framed. Use Stealth mode to try Google Translate, or use Portal's built-in search.", useStealth: true },
    "twitter.com": { advice: "X blocks framing. Try Stealth mode (Google Translate proxy) or a Nitter mirror.", alt: "https://nitter.net/", useStealth: true },
    "x.com": { advice: "X blocks framing. Try Stealth mode (Google Translate proxy) or a Nitter mirror.", alt: "https://nitter.net/", useStealth: true },
    "netflix.com": { advice: "DRM video cannot be proxied in a frame. Use a cloaked tab on your home network." },
    "roblox.com": { advice: "Roblox needs its native client — the website itself can be proxied with Stealth mode.", useStealth: true },
    "chatgpt.com": { advice: "ChatGPT blocks framing. Try Stealth mode or use the built-in KALMIA AI.", useStealth: true },
    "openai.com": { advice: "OpenAI blocks framing. Try Stealth mode or use KALMIA.", useStealth: true },
  };
  const entry = map[hit] || { advice: "This site sends anti-framing headers. Try Stealth mode, a full proxy engine, or a cloaked tab.", useStealth: true };
  return { host, ...entry };
}
