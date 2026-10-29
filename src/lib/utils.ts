import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const fmt = (n: number) => {
  if (!isFinite(n)) return "∞";
  if (Math.abs(n) >= 1e15) return n.toExponential(2).replace("+", "");
  return Math.floor(n).toLocaleString("en-US");
};
export const short = (n: number) => {
  const u = ["", "K", "M", "B", "T", "Qa", "Qi"];
  let i = 0;
  while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (i === 0 ? Math.floor(n) : n.toFixed(2)) + u[i];
};
export const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(s.slice(0, 2), 16) || 0,
    g: parseInt(s.slice(2, 4), 16) || 0,
    b: parseInt(s.slice(4, 6), 16) || 0,
  };
};
export const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");

export const relTime = (ts: number) => {
  const d = Date.now() - ts;
  if (d < 5000) return "just now";
  if (d < 60000) return Math.floor(d / 1000) + "s ago";
  if (d < 3600000) return Math.floor(d / 60000) + "m ago";
  if (d < 86400000) return Math.floor(d / 3600000) + "h ago";
  return Math.floor(d / 86400000) + "d ago";
};

export const clockString = (d = new Date(), h24 = true) =>
  d.toLocaleTimeString("en-US", { hour12: !h24, hour: "2-digit", minute: "2-digit", second: "2-digit" });

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy");
      ta.remove(); return ok;
    } catch { return false; }
  }
}

export function download(name: string, data: string | Blob, type = "text/plain") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function compressImage(file: File, maxDim = 1600, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export async function sha256(text: string) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sglr.v6::" + text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
    return "fb" + Math.abs(h).toString(16);
  }
}

/** Safe-ish arithmetic evaluator: only numbers, operators and Math functions. */
export function evalMath(expr: string): number | null {
  const cleaned = expr.replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**");
  if (!cleaned || !/^[0-9+\-*/%().,a-zA-Z]*$/.test(cleaned)) return null;
  if (/[a-zA-Z]/.test(cleaned.replace(/(sin|cos|tan|sqrt|abs|log|log2|ln|exp|pow|min|max|round|floor|ceil|PI|E|random)/g, ""))) return null;
  try {
    const scope = "const {sin,cos,tan,sqrt,abs,log,log2,exp,pow,min,max,round,floor,ceil,PI,E,random}=Math;const ln=Math.log;";
    // eslint-disable-next-line no-new-func
    const val = new Function(scope + "return (" + cleaned + ")")();
    return typeof val === "number" && isFinite(val) ? val : null;
  } catch { return null; }
}

export const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
export const bytes = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : (n / 1024).toFixed(1) + " KB");

export function normalizeUrl(u: string) {
  const t = u.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+.*$/.test(t)) return "https://" + t;
  return "https://duckduckgo.com/?q=" + encodeURIComponent(t);
}
