import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, ArrowRight, RotateCw, ExternalLink, Home, Plus, Trash2, ShieldOff,
  Globe, Star, Search, Zap, BookOpen, Monitor, Sparkles, X, Lock,
  MonitorPlay, Music2, Library, AlertTriangle, Play, Loader2,
  Ghost, Shield, RefreshCw,
} from "lucide-react";
import { useOS, useProfile, setS, useSettings } from "@/state/store";
import { useUI, toast, openApp } from "@/state/ui";
import { saveNoteToVault } from "@/lib/nova";
import { CLOAKS } from "@/lib/themes";
import {
  parseYouTube, ytEmbed, ytPlaylistEmbed, searchYouTube, parseTikTok, tikTokEmbed,
  githubToCdn, googleTranslateProxy, waybackProxy, CORS_RELAYS, PROXY_ENGINES, DIRECTORY,
  DIR_CATS, blockerAdvice, type YTResult,
} from "@/lib/web";
import { Btn, Card, IconBtn, TextInput, Section, Chips } from "@/ui/kit";
import { cn, uid } from "@/lib/utils";

type Mode = "auto" | "proxy" | "reader" | "direct" | "search" | "youtube" | "tiktok" | "stealth";

interface Hit { title: string; url: string; snippet: string; source: string }
interface Tab {
  id: string; title: string; url: string; input: string; mode: Mode;
  hist: { url: string; mode: Mode }[]; hi: number;
  loading: boolean; doc: string; text: string; hits: Hit[];
  yt: YTResult[]; ytId: string; ttId: string; err: string; relay: string;
  stealthBackend?: "translate" | "wayback" | "engines";
}

const newTab = (p?: Partial<Tab>): Tab => ({
  id: uid(), title: "New Tab", url: "", input: "", mode: "auto", hist: [], hi: -1,
  loading: false, doc: "", text: "", hits: [], yt: [], ytId: "", ttId: "", err: "", relay: "", ...p,
});

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim()) || (!/\s/.test(s.trim()) && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(s.trim()));

/** HTML rewriter: injects <base>, intercepts clicks, strips anti-framing headers,
 *  and fixes common issues for pages loaded through CORS relays. */
function rewrite(raw: string, target: string): { doc: string; title: string; plain: string } {
  let baseHref = target;
  try {
    const u = new URL(target);
    baseHref = u.href.endsWith("/") || /\.html?$/i.test(u.pathname) ? u.href : u.origin + u.pathname.replace(/[^/]*$/, "");
  } catch { /* ignore */ }
  const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || target.replace(/^https?:\/\//, "")).replace(/\s+/g, " ").trim().slice(0, 60);
  const plain = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 5000);

  const safeTarget = JSON.stringify(target);
  const head = `<base href="${baseHref}"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="">
<script>
(function(){
  // Intercept clicks to route back through portal navigation
  document.addEventListener('click',function(e){
    var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;
    if(!a)return;var h=a.getAttribute('href');
    if(!h||h[0]==='#'||h.indexOf('javascript:')===0||h.indexOf('mailto:')===0||h.indexOf('tel:')===0)return;
    e.preventDefault();
    try{parent.postMessage({type:'sglr-nav',url:new URL(h,${safeTarget}).href},'*');}catch(_){}
  },true);
  // Intercept form submissions
  document.addEventListener('submit',function(e){
    var f=e.target;if(!f||f.tagName!=='FORM')return;
    var act=f.getAttribute('action')||${safeTarget};
    var m=(f.getAttribute('method')||'GET').toUpperCase();
    if(m!=='GET')return;
    e.preventDefault();
    try{
      var fd=new FormData(f);var params=new URLSearchParams();
      fd.forEach(function(v,k){if(typeof v==='string')params.append(k,v);});
      var url=new URL(act,${safeTarget});url.search=params.toString();
      parent.postMessage({type:'sglr-nav',url:url.href},'*');
    }catch(_){}
  },true);
  // Prevent frame-busting
  window.top = window; window.parent = window;
  if(window.location.ancestorOrigins)Object.defineProperty(window,'top',{get:function(){return window;}});
  // Fix image URLs that are protocol-relative
  document.addEventListener('error',function(e){
    var t=e.target;if(!t||t.tagName!=='IMG')return;
    var src=t.getAttribute('src');
    if(src&&src.startsWith('//')){t.src='https:'+src;}
  },true);
})();
</script>`;

  // Remove anti-framing and CSP meta tags
  let cleaned = raw
    .replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "")
    .replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "")
    .replace(/<meta[^>]*http-equiv=["']?Refresh["']?[^>]*>/gi, "")
    .replace(/<meta[^>]*name=["']?referrer["']?[^>]*>/gi, "");

  // Strip known frame-buster scripts (simple heuristic)
  cleaned = cleaned.replace(/<script[^>]*>([\s\S]{0,500}?)(top\.location|parent\.location|window\.top\.location|self\.location\s*=\s*top\.location)([\s\S]*?)<\/script>/gi, "<!--frame-buster removed-->");

  // Wrap in proper document if needed
  const doc = cleaned.includes("<head")
    ? cleaned.replace(/<head[^>]*>/i, (m) => m + head)
    : `<!doctype html><html><head>${head}<title>${title}</title></head><body>${cleaned}</body></html>`;
  return { doc, title, plain };
}

/** Try all CORS relays in order, with race & fallback. */
async function relayFetch(target: string, timeoutMs = 7000): Promise<{ html: string; relay: string }> {
  // Try two relays in parallel for speed
  const tryOne = async (relay: typeof CORS_RELAYS[number]): Promise<{ html: string; relay: string } | null> => {
    try {
      const html = await Promise.race([
        relay.fn(target),
        new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
      ]);
      if (html && html.length > 60) return { html, relay: relay.name };
    } catch { /* next */ }
    return null;
  };

  // Try 2 relays in parallel per wave for responsiveness
  for (let i = 0; i < CORS_RELAYS.length; i += 2) {
    const batch = CORS_RELAYS.slice(i, i + 2);
    const results = await Promise.all(batch.map(tryOne));
    for (const r of results) if (r) return r;
  }
  throw new Error("All CORS relays blocked");
}

async function readerFetch(target: string): Promise<{ title: string; md: string; relay: string }> {
  const wiki = target.match(/([a-z]{2,3})\.wikipedia\.org\/wiki\/([^#?]+)/i);
  if (wiki) {
    try {
      const r = await fetch(`https://${wiki[1]}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${wiki[2]}&format=json&origin=*`);
      const j = await r.json();
      const page = Object.values(j?.query?.pages || {})[0] as any;
      if (page?.extract) return { title: page.title, md: `# ${page.title}\n\n${page.extract}`, relay: "Wikipedia API" };
    } catch { /* fall through */ }
  }
  // Jina reader
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    const r = await fetch(`https://r.jina.ai/${target}`, { signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok) {
      const t = await r.text();
      if (t.length > 80) return { title: (t.split("\n")[0] || target).replace(/^Title:\s*/i, "").slice(0, 70), md: t, relay: "Jina Reader" };
    }
  } catch { /* fall through */ }
  // CORS relays
  const { html, relay } = await relayFetch(target);
  const p = rewrite(html, target);
  return { title: p.title, md: `# ${p.title}\n**Source:** ${target}\n\n${p.plain}`, relay: relay + " → text" };
}

async function nativeSearch(q: string): Promise<Hit[]> {
  const hits: Hit[] = [];
  const enc = encodeURIComponent(q);
  await Promise.allSettled([
    (async () => {
      const j = await (await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${enc}&utf8=&format=json&origin=*&srlimit=6`)).json();
      for (const it of j?.query?.search || []) hits.push({ title: it.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(it.title.replace(/ /g, "_"))}`, snippet: String(it.snippet || "").replace(/<[^>]+>/g, ""), source: "Wikipedia" });
    })(),
    (async () => {
      const j = await (await fetch(`https://api.duckduckgo.com/?q=${enc}&format=json&no_html=1&skip_disambig=1`)).json();
      if (j?.AbstractText) hits.unshift({ title: j.Heading || q, url: j.AbstractURL, snippet: j.AbstractText, source: j.AbstractSource || "Instant answer" });
      for (const t of (j?.RelatedTopics || []).slice(0, 6)) if (t?.FirstURL) hits.push({ title: String(t.Text).split(" - ")[0].slice(0, 80), url: t.FirstURL, snippet: t.Text, source: "DuckDuckGo" });
    })(),
    (async () => {
      const j = await (await fetch(`https://hn.algolia.com/api/v1/search?query=${enc}&hitsPerPage=5`)).json();
      for (const h of j?.hits || []) if (h.url) hits.push({ title: h.title, url: h.url, snippet: `${h.points ?? 0} points · ${h.num_comments ?? 0} comments`, source: "Hacker News" });
    })(),
    (async () => {
      const j = await (await fetch(`https://api.github.com/search/repositories?q=${enc}&per_page=4`)).json();
      for (const r of j?.items || []) hits.push({ title: r.full_name, url: r.html_url, snippet: `★ ${r.stargazers_count} · ${r.description || "GitHub repository"}`, source: "GitHub" });
    })(),
    (async () => {
      // Brave search suggestions via DuckDuckGo HTML (no key needed)
      try {
        const r = await fetch(`https://lite.duckduckgo.com/lite/?q=${enc}`);
        if (r.ok) {
          const html = await r.text();
          const linkRe = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
          let m; let count = 0;
          while ((m = linkRe.exec(html)) !== null && count < 5) {
            const url = m[1]; const title = m[2].replace(/<[^>]+>/g, "").trim();
            if (url && title && !url.startsWith("/")) hits.push({ title, url, snippet: "DuckDuckGo result", source: "Web" });
            count++;
          }
        }
      } catch { /* ignore */ }
    })(),
  ]);
  if (!hits.length) hits.push({ title: `Search "${q}" on Google Translate proxy`, url: `https://www.google.com/search?q=${enc}`, snippet: "Open through stealth proxy when CORS relays fail.", source: "Fallback" });
  return hits;
}

export default function BrowserApp() {
  const prof = useProfile();
  const s = useSettings();
  const update = useOS((o) => o.updateProfile);
  const setBrowserPage = useUI((u) => u.setBrowserPage);
  const pendingNav = useUI((u) => u.pendingNav);
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab()]);
  const [activeId, setActiveId] = useState(() => tabs[0].id);
  const [showDir, setShowDir] = useState(false);
  const [dirCat, setDirCat] = useState("All");
  const [ttInput, setTtInput] = useState("");
  const lastNav = useRef(0);
  const active = tabs.find((t) => t.id === activeId) || tabs[0];

  const patch = useCallback((id: string, p: Partial<Tab>) => setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t))), []);

  const navigate = useCallback(async (tabId: string, raw: string, forced?: Mode, push = true) => {
    const q = raw.trim();
    if (!q) return;
    const cur = tabs.find((t) => t.id === tabId) || active;
    const url = isUrl(q) ? (/^https?:\/\//i.test(q) ? q : "https://" + q) : q;

    let mode: Mode = forced ?? cur.mode;
    if (mode === "auto" || !forced) {
      if (/youtu\.?be|youtube\.com|yt\.be/i.test(url)) mode = "youtube";
      else if (/tiktok\.com/i.test(url)) mode = "tiktok";
      else if (githubToCdn(url)) mode = "direct";
      else if (!isUrl(q)) mode = "search";
      else mode = "proxy";
    }

    const hist = push ? [...cur.hist.slice(0, cur.hi + 1), { url, mode }] : cur.hist;
    patch(tabId, {
      url, input: url, mode, hist, hi: push ? hist.length - 1 : cur.hi,
      loading: true, err: "", doc: "", hits: [], yt: [], ytId: "", ttId: "",
      title: mode === "search" ? `Search: ${q}` : url.replace(/^https?:\/\//, "").slice(0, 34),
      stealthBackend: undefined,
    });

    if (mode === "search") {
      const hits = await nativeSearch(q);
      patch(tabId, { loading: false, hits, title: `🔍 ${q}`, relay: "Native multi-source" });
      setBrowserPage({ url: `search://${q}`, title: `Search: ${q}`, content: hits.map((h) => `${h.title}: ${h.snippet}`).join("\n"), mode: "search" });
      return;
    }
    if (mode === "youtube") {
      const p = parseYouTube(url);
      if (p.videoId) {
        patch(tabId, { loading: false, ytId: p.videoId, title: "YouTube player", relay: "youtube-nocookie embed" });
        setBrowserPage({ url, title: "YouTube video", content: `Playing YouTube video ${p.videoId}`, mode: "youtube" });
      } else if (p.listId) {
        patch(tabId, { loading: false, ytId: "list:" + p.listId, title: "YouTube playlist", relay: "playlist embed" });
      } else {
        const term = p.query || q.replace(/^https?:\/\/\S+$/, "").trim();
        if (!term) { patch(tabId, { loading: false, relay: "YouTube" }); return; }
        const { results, source } = await searchYouTube(term);
        patch(tabId, { loading: false, yt: results, title: `YT: ${term}`, relay: source || "no mirror reachable", err: results.length ? "" : "Search mirrors are unreachable on this network. Paste a video link to play it, or open a cloaked tab." });
        setBrowserPage({ url, title: `YouTube: ${term}`, content: results.map((r) => r.title).join("\n"), mode: "youtube" });
      }
      return;
    }
    if (mode === "tiktok") {
      const p = parseTikTok(url);
      setTtInput(url);
      patch(tabId, { loading: false, ttId: p.videoId || "", relay: p.videoId ? "official TikTok Player v1" : "TikTok", title: p.videoId ? "TikTok video" : "TikTok" });
      setBrowserPage({ url, title: "TikTok", content: p.videoId ? `TikTok video ${p.videoId}` : "TikTok hub", mode: "tiktok" });
      return;
    }
    if (mode === "direct") {
      const cdn = githubToCdn(url);
      const finalUrl = cdn ? cdn.url : url;
      patch(tabId, { loading: false, url: finalUrl, input: finalUrl, relay: cdn?.label || "Direct frame" });
      setBrowserPage({ url: finalUrl, title: finalUrl, content: `Direct frame: ${finalUrl}`, mode: "direct" });
      return;
    }
    if (mode === "reader") {
      try {
        const r = await readerFetch(url);
        patch(tabId, { loading: false, title: r.title, text: r.md, relay: r.relay });
        setBrowserPage({ url, title: r.title, content: r.md, mode: "reader" });
      } catch (e: any) { patch(tabId, { loading: false, err: String(e?.message || e) }); }
      return;
    }
    if (mode === "stealth") {
      // Use Google Translate as iframe (works when CORS relays blocked)
      const translateUrl = googleTranslateProxy(url);
      patch(tabId, {
        loading: false,
        url: translateUrl,
        input: url,
        relay: "Google Translate ★",
        title: url.replace(/^https?:\/\//, "").slice(0, 34),
        stealthBackend: "translate",
      });
      setBrowserPage({ url: translateUrl, title: `Stealth: ${url}`, content: `Stealth proxy via Google Translate: ${url}`, mode: "stealth" });
      return;
    }
    // proxy mode - try CORS relays, then fall back gracefully
    try {
      const { html, relay } = await relayFetch(url);
      const built = rewrite(html, url);
      patch(tabId, { loading: false, title: built.title, doc: built.doc, text: built.plain, relay });
      setBrowserPage({ url, title: built.title, content: built.plain, mode: "proxy" });
    } catch {
      // Auto-fallback: try stealth (Google Translate iframe) first since it's most reliable on filtered networks
      try {
        const translateUrl = googleTranslateProxy(url);
        patch(tabId, {
          loading: false,
          mode: "stealth",
          url: translateUrl,
          input: url,
          relay: "Auto-fallback: Google Translate ★",
          title: url.replace(/^https?:\/\//, "").slice(0, 34),
          stealthBackend: "translate",
          err: "CORS relays blocked — switched to Google Translate stealth mode.",
        });
        setBrowserPage({ url: translateUrl, title: `Stealth: ${url}`, content: `Stealth proxy via Google Translate: ${url}`, mode: "stealth" });
        toast("Switched to Stealth mode", "Google Translate proxy engaged", "ok");
        return;
      } catch { /* next */ }
      try {
        const r = await readerFetch(url);
        patch(tabId, { loading: false, mode: "reader", title: r.title, text: r.md, relay: r.relay + " (fallback)" });
        setBrowserPage({ url, title: r.title, content: r.md, mode: "reader" });
      } catch {
        patch(tabId, { loading: false, err: "All relays and stealth proxies blocked. Try a cloaked tab or one of the full proxy engines below.", relay: "blocked" });
      }
    }
  }, [active, patch, setBrowserPage, tabs]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "sglr-nav" && typeof e.data.url === "string") void navigate(active.id, e.data.url);
      if (e.origin === "https://www.tiktok.com" && e.data?.["x-tiktok-player"] && e.data?.type === "onPlayerError") {
        const code = e.data?.value?.errorCode ?? "unknown";
        patch(active.id, { err: `TikTok player error ${code}. The post may be private, region-limited, or unavailable for embedding.` });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [active.id, navigate, patch]);

  /* KALMIA agent navigation */
  useEffect(() => {
    if (!pendingNav || pendingNav.nonce === lastNav.current) return;
    lastNav.current = pendingNav.nonce;
    const m = pendingNav.mode === "auto" ? undefined : (pendingNav.mode as Mode);
    void navigate(active.id, pendingNav.url, m);
  }, [pendingNav, active.id, navigate]);

  const cloak = (u?: string, cloakName?: string) => {
    const target = u || active.url || "https://www.youtube.com";
    let cloak = CLOAKS.find(c => c.id === (cloakName || s.cloak)) || CLOAKS[1];
    if (cloak.id === "none") cloak = CLOAKS[1]; // default to Classroom when no cloak selected
    const w = window.open("about:blank", "_blank");
    if (!w) { toast("Popup blocked", "Allow popups for cloaked tabs", "bad"); return; }
    w.document.write(`<!doctype html><html><head>
<title>${cloak.title}</title>
<link rel="icon" href="${cloak.icon}">
<style>
html,body{margin:0;height:100%;background:#fff;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
#cloak-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#fff;border-bottom:1px solid #e0e0e0;font-size:12px;color:#5f6368}
#cloak-bar img{height:18px}
#cloak-bar span{font-weight:500;color:#202124}
#iframe-wrap{position:absolute;top:32px;left:0;right:0;bottom:0;background:#000}
iframe{border:0;width:100%;height:100%}
</style>
</head><body>
<div id="cloak-bar"><img src="${cloak.icon}" alt=""><span>${cloak.name}</span></div>
<div id="iframe-wrap"><iframe src="${target}" allow="autoplay; fullscreen; encrypted-media; clipboard-read; clipboard-write; microphone; camera" allowfullscreen></iframe></div>
</body></html>`);
    w.document.close();
    toast("Cloaked tab opened", `Disguised as ${cloak.name}`, "ok");
  };

  const advice = useMemo(() => (active.url ? blockerAdvice(active.url) : null), [active.url]);
  const dirList = dirCat === "All" ? DIRECTORY : DIRECTORY.filter((d) => d.cat === dirCat);

  const engineBtns: { id: Mode; label: string; icon: typeof Zap; tip: string; tint?: string }[] = [
    { id: "proxy", label: "Proxy", icon: Zap, tip: "Fetch through CORS relays and rewrite the HTML" },
    { id: "stealth", label: "Stealth", icon: Ghost, tip: "★ Bypass filters via Google Translate — works when others fail", tint: "#4ade80" },
    { id: "reader", label: "Reader", icon: BookOpen, tip: "Clean article text, fastest option" },
    { id: "direct", label: "Direct", icon: Monitor, tip: "Plain iframe — also resolves GitHub files via CDN" },
    { id: "youtube", label: "YouTube", icon: MonitorPlay, tip: "Native search + embed player" },
    { id: "tiktok", label: "TikTok", icon: Music2, tip: "Paste a video link to play it embedded" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#080a10]">
      {/* tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-line bg-black/40 px-2 pt-1.5">
        <div className="scroll-thin flex flex-1 items-center gap-1 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <div key={t.id} onClick={() => setActiveId(t.id)}
              className={cn("group flex max-w-[190px] min-w-[118px] cursor-pointer items-center gap-2 rounded-t-xl border border-b-0 px-3 py-1.5 text-[11px] transition-all",
                t.id === active.id ? "border-line2 bg-panel text-txt" : "border-transparent bg-white/[0.02] text-faint hover:bg-white/[0.05]")}>
              {t.loading ? <Loader2 size={11} className="shrink-0 animate-spin text-accent" />
                : t.mode === "stealth" ? <Ghost size={11} className={cn("shrink-0", t.id === active.id ? "text-ok" : "text-ok/60")} />
                : <Globe size={11} className={cn("shrink-0", t.id === active.id ? "text-accent2" : "text-faint")} />}
              <span className="flex-1 truncate font-medium">{t.title}</span>
              <button onClick={(e) => {
                e.stopPropagation();
                if (tabs.length === 1) { const f = newTab(); setTabs([f]); setActiveId(f.id); return; }
                const i = tabs.findIndex((x) => x.id === t.id);
                const next = tabs.filter((x) => x.id !== t.id);
                setTabs(next);
                if (activeId === t.id) setActiveId(next[Math.max(0, i - 1)].id);
              }} className="rounded p-0.5 text-faint opacity-60 transition hover:text-bad group-hover:opacity-100"><X size={11} /></button>
            </div>
          ))}
          <button onClick={() => { const t = newTab(); setTabs((p) => [...p, t]); setActiveId(t.id); }}
            title="New tab" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim transition hover:bg-white/10 hover:text-accent"><Plus size={14} /></button>
        </div>
        <span className="hidden items-center gap-1.5 pb-1 pr-1 font-mono text-[9px] uppercase tracking-wider text-ok sm:flex">
          {active.relay.includes("Google Translate") ? <Ghost size={10} /> : <Lock size={10} />}
          {active.relay || "multi-relay proxy"}
        </span>
      </div>

      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-line bg-panel/90 px-2.5 py-2">
        <IconBtn label="Back" disabled={active.hi <= 0} onClick={() => { const p = active.hist[active.hi - 1]; if (p) { patch(active.id, { hi: active.hi - 1 }); void navigate(active.id, p.url, p.mode, false); } }}><ArrowLeft size={14} /></IconBtn>
        <IconBtn label="Forward" disabled={active.hi >= active.hist.length - 1} onClick={() => { const n = active.hist[active.hi + 1]; if (n) { patch(active.id, { hi: active.hi + 1 }); void navigate(active.id, n.url, n.mode, false); } }}><ArrowRight size={14} /></IconBtn>
        <IconBtn label="Reload" onClick={() => active.url && void navigate(active.id, active.mode === "stealth" ? active.input : active.url, active.mode, false)}>
          <RotateCw size={13} className={cn(active.loading && "animate-spin")} />
        </IconBtn>
        <IconBtn label="Start page" onClick={() => patch(active.id, { url: "", input: "", title: "New Tab", err: "", doc: "", yt: [], ytId: "", ttId: "", mode: "auto", stealthBackend: undefined })}><Home size={14} /></IconBtn>
        <div className="relative min-w-[190px] flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={active.input} onChange={(e) => patch(active.id, { input: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && void navigate(active.id, active.input, active.mode === "auto" ? undefined : active.mode)}
            placeholder="Search anything, paste any URL — Stealth mode bypasses Lightspeed/GoGuardian…"
            className="field py-1.5 pl-8 text-[12px]" />
        </div>
        <Btn size="xs" variant="primary" onClick={() => void navigate(active.id, active.input, active.mode === "auto" ? undefined : active.mode)}>Go</Btn>
        <div className="flex items-center gap-0.5 rounded-lg border border-line bg-black/30 p-0.5">
          {engineBtns.map((m) => (
            <button key={m.id} title={m.tip}
              onClick={() => { patch(active.id, { mode: m.id }); if (active.url) void navigate(active.id, active.url, m.id, false); }}
              className={cn("flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[9px] uppercase transition-all",
                active.mode === m.id
                  ? m.tint ? "font-bold" : "bg-accent font-bold text-[#0a0a0c]"
                  : "text-dim hover:text-txt")}
              style={active.mode === m.id && m.tint ? { background: m.tint + "22", color: m.tint, fontWeight: 700 } : undefined}>
              <m.icon size={10} /> <span className="hidden lg:inline">{m.label}</span>
            </button>
          ))}
        </div>
        <IconBtn label="Directory" active={showDir} onClick={() => setShowDir((v) => !v)}><Library size={14} /></IconBtn>
        <Btn size="xs" variant="soft" icon={<Sparkles size={11} />} onClick={() => { if (active.text) saveNoteToVault(`Portal: ${active.title}`, active.text.slice(0, 2600), "portal"); openApp("ai"); toast("Page sent to KALMIA", "Ask it to summarise or quiz you", "ok"); }}>KALMIA</Btn>
        <IconBtn label="Bookmark" onClick={() => { if (!active.url) return toast("Open a page first", undefined, "warn"); update((p) => ({ ...p, links: [...p.links, { id: uid(), title: active.title, url: active.mode === "stealth" ? active.input : active.url, hits: 1 }] })); toast("Bookmarked", undefined, "ok"); }}><Star size={14} /></IconBtn>
        <div className="relative">
          <IconBtn label="Cloaked tab" onClick={() => cloak()}><ShieldOff size={14} /></IconBtn>
        </div>
        <IconBtn label="Real tab" onClick={() => window.open(active.mode === "stealth" ? active.input : active.url, "_blank", "noopener")}><ExternalLink size={14} /></IconBtn>
      </div>

      {active.loading && <div className="h-0.5 w-full overflow-hidden bg-white/10"><div className="h-full w-1/3 animate-pulse bg-accent" /></div>}

      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="scroll-thin hidden w-[182px] shrink-0 flex-col overflow-y-auto border-r border-line bg-black/25 p-2.5 md:flex">
          <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">bookmarks</div>
          {prof.links.map((l) => (
            <div key={l.id} className="group flex items-center gap-1">
              <button onClick={() => void navigate(active.id, l.url)} className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-accent/40 hover:bg-accent/10">
                <div className="truncate text-[11px] font-medium text-txt">{l.title}</div>
                <div className="truncate font-mono text-[8px] text-faint">{l.url.replace(/^https?:\/\//, "")}</div>
              </button>
              <button onClick={() => update((p) => ({ ...p, links: p.links.filter((x) => x.id !== l.id) }))}
                className="shrink-0 text-faint opacity-0 transition hover:text-bad group-hover:opacity-100"><Trash2 size={11} /></button>
            </div>
          ))}
          <Btn size="xs" className="mt-2 w-full" icon={<Library size={11} />} onClick={() => setShowDir(true)}>Directory</Btn>

          <div className="mb-1.5 mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-ok">★ stealth</div>
          <p className="mb-2 text-[10px] leading-tight text-dim">Routes traffic through translate.google.com — almost never blocked on school networks.</p>
          <Btn size="xs" className="w-full" icon={<Ghost size={11} />} onClick={() => {
            if (active.url && active.mode !== "stealth") void navigate(active.id, active.url, "stealth", false);
            else toast("Enter a URL first", undefined, "warn");
          }}>Engage stealth</Btn>
          <Btn size="xs" variant="soft" className="mt-1 w-full" icon={<Shield size={11} />} onClick={() => cloak()}>about:blank cloak</Btn>

          <div className="mb-1.5 mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-faint">tab disguise</div>
          <Chips options={CLOAKS.map((c) => ({ v: c.id, label: c.name }))} value={s.cloak}
            onChange={(v) => { setS({ cloak: v }); toast(`Cloak · ${CLOAKS.find((c) => c.id === v)?.name}`, undefined, "ok"); }} cols={2} />
          <Btn size="xs" className="mt-2 w-full" icon={<ShieldOff size={11} />} onClick={() => cloak()}>about:blank cloak</Btn>
          <Btn size="xs" variant="soft" className="mt-1.5 w-full" onClick={() => cloak(location.href)}>Cloak whole OS</Btn>
        </aside>

        {/* viewport */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          {showDir ? (
            <div className="scroll-thin h-full overflow-y-auto p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-txt">Unblocked directory</h2>
                  <p className="text-[11px] text-dim">{DIRECTORY.length} curated destinations · Stealth proxies marked ★ work through Lightspeed/GoGuardian</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chips options={DIR_CATS.map((c) => ({ v: c, label: c }))} value={dirCat} onChange={setDirCat} cols={5} />
                  <IconBtn label="Close directory" onClick={() => setShowDir(false)}><X size={15} /></IconBtn>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
                {dirList.map((d) => (
                  <button key={d.name + d.url} onClick={() => { setShowDir(false); void navigate(active.id, d.url, d.mode as Mode); }}
                    className="group rounded-xl border border-line bg-white/[0.025] p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:bg-accent/[0.07]">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="rounded bg-accent2/15 px-1.5 py-0.5 font-mono text-[8px] uppercase text-accent2">{d.cat}</span>
                      <span className="font-mono text-[8px] uppercase text-faint">{d.mode}</span>
                    </div>
                    <div className="truncate font-display text-[13px] font-bold text-txt group-hover:text-accent">{d.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-faint">{d.note}</div>
                  </button>
                ))}
              </div>

              <Section title="Full proxy engines" hint="Server-side proxies handle logins and sites that block framing. ★ = works even when Lightspeed blocks CORS relays">
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                  {PROXY_ENGINES.map((p) => (
                    <div key={p.name} className="rounded-xl border border-line bg-white/[0.025] p-3">
                      <div className="flex items-center gap-1.5">
                        <div className="font-display text-[13px] font-bold" style={{ color: p.tint }}>{p.name}</div>
                        {(p as any).builtin && <span className="rounded bg-ok/20 px-1 py-0.5 font-mono text-[7px] uppercase text-ok">built-in ★</span>}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-snug text-faint">{p.note}</div>
                      <div className="mt-2 flex gap-1.5">
                        {(p as any).builtin === "translate" ? (
                          <Btn size="xs" onClick={() => {
                            setShowDir(false);
                            const target = active.input || "https://www.google.com";
                            const tu = googleTranslateProxy(target.startsWith("http") ? target : `https://${target}`);
                            patch(active.id, { mode: "stealth", url: tu, input: target, title: target.replace(/^https?:\/\//, "").slice(0, 34), relay: "Google Translate ★", stealthBackend: "translate", loading: false, err: "" });
                          }}>Open here</Btn>
                        ) : (p as any).builtin === "wayback" ? (
                          <Btn size="xs" onClick={() => { setShowDir(false); void navigate(active.id, active.url || "https://example.com", "stealth", false); }}>Open here</Btn>
                        ) : (
                          <>
                            <Btn size="xs" onClick={() => { setShowDir(false); void navigate(active.id, p.url, "direct"); }}>Open here</Btn>
                            <Btn size="xs" variant="soft" onClick={() => cloak(p.url)}>Cloaked</Btn>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          ) : !active.url ? (
            /* start page */
            <div className="scroll-thin h-full overflow-y-auto p-5">
              <div className="mx-auto max-w-2xl">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ok">
                  <Ghost size={10} /> stealth mode · beats lightspeed, goguardian & securly
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-txt">Portal</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-dim">
                  Search the web, play YouTube & TikTok, load games straight from GitHub, or push any site through
                  <span className="mx-1 rounded bg-ok/15 px-1 font-semibold text-ok">Stealth Proxy</span>
                  — routes through Google Translate so it loads even when Lightspeed blocks the CORS relays.
                </p>
                <div className="my-4 flex gap-2">
                  <TextInput value={active.input} onChange={(e) => patch(active.id, { input: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && void navigate(active.id, active.input)}
                    placeholder="Search anything, or paste any URL…" className="py-2.5 text-[13px]" />
                  <Btn variant="primary" size="md" onClick={() => void navigate(active.id, active.input)}>Go</Btn>
                  <Btn size="md" icon={<Ghost size={14} />} onClick={() => {
                    const v = active.input.trim();
                    if (!v) { toast("Enter a URL first", undefined, "warn"); return; }
                    const url = isUrl(v) ? (/^https?:\/\//i.test(v) ? v : "https://" + v) : `https://www.google.com/search?q=${encodeURIComponent(v)}`;
                    void navigate(active.id, url, "stealth");
                  }} title="Stealth (Google Translate)" style={{ background: "#4ade8022", color: "#4ade80", borderColor: "#4ade8055" }}>Stealth</Btn>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { t: "YouTube", d: "Search & play", u: "https://www.youtube.com", m: "youtube" as Mode, i: MonitorPlay, c: "#ff4d6d" },
                    { t: "TikTok", d: "Paste a video", u: "https://www.tiktok.com", m: "tiktok" as Mode, i: Music2, c: "#6ee7ff" },
                    { t: "Directory", d: `${DIRECTORY.length} links`, u: "", m: "proxy" as Mode, i: Library, c: "#9ef01a" },
                    { t: "Desmos", d: "Graphing", u: "https://www.desmos.com/calculator", m: "direct" as Mode, i: Monitor, c: "#ffd166" },
                    { t: "Stealth", d: "Unblock any site", u: "https://www.google.com", m: "stealth" as Mode, i: Ghost, c: "#4ade80" },
                    { t: "Discord", d: "Stealth proxy", u: "https://discord.com/app", m: "stealth" as Mode, i: MessageCircleDummy, c: "#5865F2" },
                    { t: "Games", d: "Poki", u: "https://poki.com/", m: "proxy" as Mode, i: Play, c: "#c4b5fd" },
                    { t: "Khan Academy", d: "Learning", u: "https://www.khanacademy.org/", m: "direct" as Mode, i: BookOpen, c: "#fb923c" },
                  ].map((x) => (
                    <button key={x.t} onClick={() => (x.u ? void navigate(active.id, x.u, x.m) : setShowDir(true))}
                      className="group rounded-xl border border-line bg-white/[0.025] p-3 text-left transition hover:-translate-y-0.5 hover:border-accent">
                      <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg" style={{ background: x.c + "22", color: x.c }}><x.i size={15} /></span>
                      <div className="font-display text-[13px] font-bold text-txt group-hover:text-accent">{x.t}</div>
                      <div className="font-mono text-[9px] text-faint">{x.d}</div>
                    </button>
                  ))}
                </div>
                <Card className="mt-4">
                  <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-txt"><Ghost size={13} className="text-ok" /> How Stealth mode works</div>
                  <p className="text-[11px] leading-relaxed text-dim">
                    When you enable <b>Stealth</b>, the page loads through <code className="rounded bg-white/10 px-1">translate.google.com</code>.
                    Because Google Translate is a legitimate educational tool, 99% of school filters (including Lightspeed) whitelist it.
                    If CORS relays fail on any navigation, Portal automatically falls back to Stealth mode.
                  </p>
                </Card>
              </div>
            </div>
          ) : active.mode === "youtube" ? (
            <div className="scroll-thin h-full overflow-y-auto">
              {active.ytId ? (
                <div className="flex h-full flex-col">
                  <iframe className="min-h-0 w-full flex-1 border-0 bg-black"
                    src={active.ytId.startsWith("list:") ? ytPlaylistEmbed(active.ytId.slice(5)) : ytEmbed(active.ytId)}
                    title="YouTube player" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
                  <div className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2">
                    <Btn size="xs" onClick={() => patch(active.id, { ytId: "" })}>Back to results</Btn>
                    <Btn size="xs" variant="soft" onClick={() => cloak(`https://www.youtube.com/watch?v=${active.ytId}`)}>Cloaked tab</Btn>
                    <span className="font-mono text-[9px] text-faint">privacy-enhanced embed · no cookies</span>
                  </div>
                </div>
              ) : active.yt.length ? (
                <div className="p-4">
                  <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{active.yt.length} results · {active.relay}</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {active.yt.map((v) => (
                      <button key={v.id} onClick={() => patch(active.id, { ytId: v.id })}
                        className="group overflow-hidden rounded-xl border border-line bg-white/[0.025] text-left transition hover:border-accent">
                        <div className="relative aspect-video bg-black/50">
                          {v.thumb && <img src={v.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />}
                          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent text-[#0a0a0c]"><Play size={16} fill="currentColor" /></span>
                          </span>
                          {v.duration && <span className="absolute bottom-1 right-1 rounded bg-black/85 px-1 font-mono text-[9px] text-white">{v.duration}</span>}
                        </div>
                        <div className="p-2.5">
                          <div className="line-clamp-2 text-[12px] font-medium text-txt group-hover:text-accent">{v.title}</div>
                          <div className="mt-0.5 truncate font-mono text-[9px] text-faint">{v.author}{v.views ? ` · ${v.views}` : ""}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid h-full place-items-center p-6">
                  <div className="max-w-md text-center">
                    <MonitorPlay size={34} className="mx-auto mb-3 text-bad" />
                    <h3 className="font-display text-lg font-bold text-txt">YouTube</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-dim">{active.err || "Type a search term, or paste any video link to play it in the built-in player."}</p>
                    <div className="mt-3 flex gap-2">
                      <TextInput value={active.input} onChange={(e) => patch(active.id, { input: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && void navigate(active.id, active.input, "youtube")} placeholder="Paste a video URL or search…" />
                      <Btn variant="primary" onClick={() => void navigate(active.id, active.input, "youtube")}>Play</Btn>
                    </div>
                    <Btn className="mt-2" size="xs" onClick={() => cloak("https://www.youtube.com")}>Open YouTube in a cloaked tab</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : active.mode === "tiktok" ? (
            <div className="flex h-full">
              {active.ttId ? (
                <div className="relative flex h-full w-full flex-col bg-black">
                  <iframe className="min-h-0 w-full flex-1 border-0 bg-black" src={tikTokEmbed(active.ttId)} title="TikTok video" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
                  {active.err && (
                    <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-black/90 px-3 py-2">
                      <span className="text-[11px] text-warn">{active.err}</span>
                      <Btn size="xs" variant="soft" onClick={() => window.open(active.url, "_blank", "noopener")}>Open TikTok</Btn>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-1.5">
                    <span className="font-mono text-[9px] text-faint">Official TikTok Player v1 · individual public post</span>
                    <Btn size="xs" variant="soft" icon={<ExternalLink size={10} />} onClick={() => window.open(active.url, "_blank", "noopener")}>Open TikTok</Btn>
                  </div>
                </div>
              ) : (
                <div className="scroll-thin flex-1 overflow-y-auto p-6">
                  <div className="mx-auto max-w-lg">
                    <Music2 size={32} className="mb-3 text-accent2" />
                    <h3 className="font-display text-xl font-bold text-txt">TikTok player</h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-dim">
                      This uses TikTok's official Player v1 iframe. Individual public videos can play here; TikTok controls whether a post is embeddable.
                      Paste a link like <code className="mx-1 rounded bg-white/10 px-1 font-mono text-[11px]">tiktok.com/@user/video/123…</code> and it loads right here.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <TextInput value={ttInput} onChange={(e) => setTtInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void navigate(active.id, ttInput, "tiktok")} placeholder="Paste a TikTok video link…" />
                      <Btn variant="primary" onClick={() => void navigate(active.id, ttInput, "tiktok")}>Play</Btn>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Card>
                        <div className="text-[12px] font-semibold text-txt">Watch the full feed</div>
                        <p className="mt-1 text-[11px] text-dim">Urlebird mirrors TikTok and allows framing.</p>
                        <Btn size="xs" className="mt-2" onClick={() => void navigate(active.id, "https://urlebird.com/", "proxy")}>Open Urlebird</Btn>
                      </Card>
                      <Card>
                        <div className="text-[12px] font-semibold text-ok">★ Stealth full TikTok</div>
                        <p className="mt-1 text-[11px] text-dim">Real TikTok via Google Translate proxy.</p>
                        <Btn size="xs" variant="soft" className="mt-2" onClick={() => void navigate(active.id, "https://www.tiktok.com", "stealth")}>Stealth TikTok</Btn>
                      </Card>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : active.mode === "search" ? (
            <div className="scroll-thin h-full overflow-y-auto p-5">
              <div className="mx-auto max-w-2xl">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{active.hits.length} instant results · no tracking</div>
                <div className="flex flex-col gap-2.5">
                  {active.hits.map((h, i) => (
                    <div key={i} className="rounded-xl border border-line bg-white/[0.025] p-3.5 transition hover:border-accent/50">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded bg-accent2/15 px-1.5 py-0.5 font-mono text-[9px] uppercase text-accent2">{h.source}</span>
                        <span className="truncate font-mono text-[10px] text-faint">{h.url}</span>
                      </div>
                      <button onClick={() => void navigate(active.id, h.url, h.url.includes("wikipedia") ? "reader" : "proxy")}
                        className="text-left font-display text-[15px] font-bold text-accent hover:underline">{h.title}</button>
                      <p className="mt-1 text-[12px] leading-relaxed text-dim">{h.snippet}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Btn size="xs" variant="soft" icon={<Zap size={11} />} onClick={() => void navigate(active.id, h.url, "proxy")}>Proxy</Btn>
                        <Btn size="xs" icon={<Ghost size={11} />} onClick={() => void navigate(active.id, h.url, "stealth")} style={{ background: "#4ade8022", color: "#4ade80" }}>Stealth</Btn>
                        <Btn size="xs" icon={<BookOpen size={11} />} onClick={() => void navigate(active.id, h.url, "reader")}>Reader</Btn>
                        <Btn size="xs" icon={<ShieldOff size={11} />} onClick={() => cloak(h.url)}>Cloaked</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : active.mode === "reader" ? (
            <div className="scroll-thin h-full overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent2">{active.relay}</div>
                    <h1 className="font-display text-2xl font-bold text-txt">{active.title}</h1>
                  </div>
                  <Btn size="xs" variant="primary" icon={<Sparkles size={12} />}
                    onClick={() => { saveNoteToVault(`Portal: ${active.title}`, active.text.slice(0, 2600), "portal"); openApp("ai"); }}>Save & ask KALMIA</Btn>
                </div>
                <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-dim">{active.text || "Loading…"}</div>
              </div>
            </div>
          ) : active.err && active.mode !== "stealth" ? (
            <div className="grid h-full place-items-center p-6">
              <div className="max-w-md text-center">
                <AlertTriangle size={32} className="mx-auto mb-3 text-warn" />
                <h3 className="font-display text-lg font-bold text-txt">This site refused the connection</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-dim">{active.err}</p>
                {advice && <p className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">{advice.advice}</p>}
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Btn size="xs" icon={<Ghost size={11} />} onClick={() => void navigate(active.id, active.url, "stealth")} style={{ background: "#4ade8022", color: "#4ade80" }}>Try Stealth ★</Btn>
                  <Btn size="xs" onClick={() => void navigate(active.id, active.url, "reader")}>Reader</Btn>
                  <Btn size="xs" onClick={() => void navigate(active.id, active.url, "direct")}>Direct</Btn>
                  <Btn size="xs" variant="soft" onClick={() => cloak(active.url)}>Cloaked tab</Btn>
                  <Btn size="xs" variant="primary" onClick={() => setShowDir(true)}>Proxy engines</Btn>
                </div>
              </div>
            </div>
          ) : active.mode === "stealth" ? (
            // Stealth mode: iframe through Google Translate (or Wayback).
            // translate.google.com renders the target page inside an iframe itself,
            // so we can load it directly. No CORS needed.
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-line bg-ok/10 px-3 py-1.5">
                <Ghost size={12} className="text-ok" />
                <span className="font-mono text-[10px] uppercase text-ok">stealth mode via {active.stealthBackend === "wayback" ? "Wayback Machine" : "Google Translate"}</span>
                <span className="truncate text-[11px] text-dim">{active.input}</span>
                <div className="ml-auto flex gap-1">
                  <Btn size="xs" variant="soft" icon={<RefreshCw size={10} />} onClick={() => {
                    // Switch between stealth backends
                    const next = active.stealthBackend === "wayback" ? "translate" : "wayback";
                    const nextUrl = next === "wayback" ? waybackProxy(active.input) : googleTranslateProxy(active.input);
                    patch(active.id, { url: nextUrl, stealthBackend: next as any, relay: next === "wayback" ? "Wayback Machine ★" : "Google Translate ★" });
                  }}>Switch backend</Btn>
                  <Btn size="xs" variant="soft" icon={<ExternalLink size={10} />} onClick={() => window.open(active.url, "_blank", "noopener")}>Open new tab</Btn>
                  <Btn size="xs" icon={<ShieldOff size={10} />} onClick={() => cloak(active.input)}>Cloak</Btn>
                </div>
              </div>
              <iframe src={active.url} title={active.title} className="min-h-0 w-full flex-1 border-0 bg-white"
                referrerPolicy="no-referrer" allow="autoplay; fullscreen; encrypted-media; clipboard-read; clipboard-write" />
            </div>
          ) : active.mode === "proxy" && active.doc ? (
            <>
              <iframe srcDoc={active.doc} title={active.title} className="h-full w-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox" />
              {advice && (
                <div className="pointer-events-auto absolute bottom-2 left-1/2 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border border-warn/40 bg-black/90 px-3 py-1.5">
                  <AlertTriangle size={11} className="shrink-0 text-warn" />
                  <span className="truncate text-[10px] text-dim">{advice.advice}</span>
                  <button onClick={() => void navigate(active.id, active.url, "stealth")} className="shrink-0 rounded bg-ok/20 px-1.5 py-0.5 font-mono text-[9px] uppercase text-ok hover:bg-ok/30">stealth</button>
                  <button onClick={() => cloak(active.url)} className="shrink-0 font-mono text-[9px] uppercase text-accent hover:underline">cloak</button>
                </div>
              )}
            </>
          ) : (
            <iframe src={active.url} title={active.title} className="h-full w-full border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer" allow="autoplay; fullscreen; encrypted-media" />
          )}
        </div>
      </div>
    </div>
  );
}

// Small dummy icon component to avoid import error
function MessageCircleDummy({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
