import { useOS, setS, setClicker, perSecond, defaultSettings } from "@/state/store";
import { useUI, toast, openApp } from "@/state/ui";
import { APPS, appMeta } from "@/os/apps/meta";
import { THEMES, SHADERS, CLOAKS } from "@/lib/themes";
import { evalMath, fmt, uid, pick, download } from "@/lib/utils";
import { sendChat, useNet } from "@/lib/net";
import type { AppId } from "@/state/store";

export const COMMAND_HELP: { cmd: string; args: string; desc: string }[] = [
  { cmd: "help", args: "[command]", desc: "List commands or explain one" },
  { cmd: "ls", args: "", desc: "List installed applications" },
  { cmd: "open", args: "<app>", desc: "Launch an application window" },
  { cmd: "close", args: "<app|all>", desc: "Close a window" },
  { cmd: "theme", args: "<id|list>", desc: "Switch the system theme" },
  { cmd: "shader", args: "<id|list>", desc: "Switch the background shader" },
  { cmd: "accent", args: "<#hex>", desc: "Set the accent colour" },
  { cmd: "fx", args: "<scan|grain|crt|snow|rain|trail> on|off", desc: "Toggle a visual effect" },
  { cmd: "click", args: "[n]", desc: "Fire the reactor n times" },
  { cmd: "count", args: "<number>", desc: "Set the reactor mass" },
  { cmd: "note", args: "<text>", desc: "Save a quick note to the Vault" },
  { cmd: "todo", args: "<text>", desc: "Add a task" },
  { cmd: "calc", args: "<expression>", desc: "Evaluate maths" },
  { cmd: "sysinfo", args: "", desc: "System + session report" },
  { cmd: "whoami", args: "", desc: "Current identity" },
  { cmd: "users", args: "", desc: "Registered accounts" },
  { cmd: "peers", args: "", desc: "Sessions live on the mesh" },
  { cmd: "msg", args: "<text>", desc: "Broadcast to every session" },
  { cmd: "cloak", args: "<id|off>", desc: "Disguise the browser tab" },
  { cmd: "panic", args: "", desc: "Instant stealth screen" },
  { cmd: "lock", args: "", desc: "Lock this session" },
  { cmd: "share", args: "", desc: "Open Screen Link" },
  { cmd: "wallpaper", args: "off", desc: "Clear the wallpaper" },
  { cmd: "export", args: "", desc: "Download a profile backup" },
  { cmd: "reset", args: "settings", desc: "Restore default modules" },
  { cmd: "fortune", args: "", desc: "Receive wisdom" },
  { cmd: "cowsay", args: "<text>", desc: "A cow says it" },
  { cmd: "echo", args: "<text>", desc: "Print text" },
  { cmd: "date", args: "", desc: "Current date & time" },
  { cmd: "clear", args: "", desc: "Clear the console" },
];

const FORTUNES = [
  "The event horizon is not a wall. It is a one-way door.",
  "Every click collapses a probability. Choose loudly.",
  "Entropy always wins. Delay it beautifully.",
  "A shader is just maths that learned to show off.",
  "You cannot escape a black hole. You can, however, theme it.",
  "Idle hands build empires — that is what drones are for.",
  "The universe is under no obligation to be legible. Your UI is.",
];

export function appByName(q: string): AppId | null {
  const s = q.toLowerCase().trim();
  const hit = APPS.find((a) => a.id === s || a.name.toLowerCase() === s || a.short.toLowerCase() === s);
  if (hit) return hit.id;
  const fuzzy = APPS.find((a) => a.keywords.includes(s) || a.name.toLowerCase().includes(s));
  return fuzzy ? fuzzy.id : null;
}

export function runCommand(line: string): string[] {
  const parts = line.trim().split(/\s+/);
  const cmd = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);
  const rest = line.trim().slice(cmd.length).trim();
  const os = useOS.getState();
  const ui = useUI.getState();
  const prof = os.session ? os.db.profiles[os.session] : null;
  if (!cmd) return [];

  switch (cmd) {
    case "help": {
      if (args[0]) {
        const h = COMMAND_HELP.find((c) => c.cmd === args[0]);
        return h ? [`${h.cmd} ${h.args} — ${h.desc}`] : [`unknown command: ${args[0]}`];
      }
      return ["SINGULARITY SHELL — available commands", ...COMMAND_HELP.map((c) => `  ${c.cmd.padEnd(11)} ${c.args.padEnd(28)} ${c.desc}`)];
    }
    case "ls": case "apps":
      return APPS.map((a) => `  ${a.id.padEnd(10)} ${a.name.padEnd(17)} ${a.desc}`);
    case "open": case "run": {
      if (!args[0]) return ["usage: open <app>   (try: ls)"];
      const id = appByName(args.join(" "));
      if (!id) return [`no application matches "${args.join(" ")}"`];
      openApp(id);
      return [`launching ${appMeta(id).name}…`];
    }
    case "close": {
      if (args[0] === "all") { ui.closeAll(); return ["all windows closed"]; }
      const id = appByName(args[0] || "");
      if (!id) return ["usage: close <app|all>"];
      ui.close(id); return [`closed ${id}`];
    }
    case "theme": {
      if (!args[0] || args[0] === "list") return ["themes: " + THEMES.map((t) => t.id).join(", ")];
      const t = THEMES.find((x) => x.id === args[0].toLowerCase());
      if (!t) return [`unknown theme "${args[0]}"`];
      setS({ theme: t.id, accent: t.vars["--accent"], accent2: t.vars["--accent-2"], shader: t.shader as any });
      return [`theme → ${t.name} · ${t.blurb}`];
    }
    case "shader": {
      if (!args[0] || args[0] === "list") return ["shaders: " + SHADERS.map((s) => s.id).join(", ")];
      const s = SHADERS.find((x) => x.id === args[0].toLowerCase());
      if (!s) return [`unknown shader "${args[0]}"`];
      setS({ shader: s.id, shaderOn: true });
      return [`shader → ${s.name}`];
    }
    case "accent": {
      if (!/^#?[0-9a-f]{6}$/i.test(args[0] || "")) return ["usage: accent #ff9f45"];
      const hex = args[0].startsWith("#") ? args[0] : "#" + args[0];
      setS({ accent: hex });
      return [`accent → ${hex}`];
    }
    case "fx": {
      const map: Record<string, keyof ReturnType<typeof defaultSettings>> = { scan: "fxScan", grain: "fxGrain", crt: "fxCrt", snow: "fxSnow", rain: "fxRain", trail: "fxTrail", vignette: "fxVignette" };
      const key = map[args[0]];
      if (!key) return ["usage: fx <scan|grain|crt|snow|rain|trail|vignette> <on|off>"];
      const on = args[1] !== "off";
      setS({ [key]: on } as any);
      return [`${args[0]} → ${on ? "on" : "off"}`];
    }
    case "click": {
      if (!prof) return ["no session"];
      const n = Math.max(1, Math.min(10000, parseInt(args[0] || "1", 10) || 1));
      const gain = prof.clicker.power * n;
      setClicker({ count: prof.clicker.count + gain, total: prof.clicker.total + gain, clicks: prof.clicker.clicks + n });
      ui.firePulse();
      return [`+${fmt(gain)} mass`];
    }
    case "count": {
      const n = parseFloat(args[0]);
      if (isNaN(n)) return ["usage: count <number>"];
      setClicker({ count: Math.max(0, n) });
      return [`reactor mass set to ${fmt(n)}`];
    }
    case "note": {
      if (!rest) return ["usage: note <text>"];
      os.updateProfile((p) => ({ ...p, notes: [{ id: uid(), title: rest.slice(0, 40), body: rest, tag: "shell", pinned: false, ts: Date.now() }, ...p.notes] }));
      return ["note saved to vault"];
    }
    case "todo": {
      if (!rest) return ["usage: todo <text>"];
      os.updateProfile((p) => ({ ...p, todos: [{ id: uid(), text: rest, done: false, pri: 1, ts: Date.now() }, ...p.todos] }));
      return ["task added"];
    }
    case "calc": {
      const v = evalMath(rest);
      return v === null ? ["cannot evaluate that"] : [`= ${v}`];
    }
    case "sysinfo": case "neofetch": {
      const nav = navigator as any;
      return [
        `      ▄▄▄▄      SINGULARITY OS  ·  build 6.0`,
        `    ▄███████▄    ───────────────────────────`,
        `   ███▀   ▀███   user      ${os.session ?? "guest"}`,
        `   ███     ███   shader    ${prof?.settings.shader} @ ${Math.round((prof?.settings.quality ?? 1) * 100)}%`,
        `   ███▄   ▄███   theme     ${prof?.settings.theme}`,
        `    ▀███████▀    reactor   ${fmt(prof?.clicker.count ?? 0)} mass · ${fmt(perSecond(prof?.clicker ?? ({ drones: 0, reactors: 0, prestige: 0, folds: 0 } as any)))}/s`,
        `      ▀▀▀▀      fps       ${ui.fps}`,
        `                 cores     ${nav.hardwareConcurrency ?? "?"}`,
        `                 memory    ${nav.deviceMemory ? nav.deviceMemory + " GB" : "n/a"}`,
        `                 screen    ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
        `                 mesh      ${Object.keys(useNet.getState().peers).length} peer(s)`,
      ];
    }
    case "whoami":
      return [`${os.session ?? "guest"} · role ${os.session ? os.db.users[os.session]?.role : "none"} · tab ${useNet.getState().id.slice(0, 6)}`];
    case "users":
      return Object.values(os.db.users).map((u) => `  ${u.name.padEnd(14)} ${u.role.padEnd(6)} created ${new Date(u.created).toLocaleDateString()}`);
    case "peers": {
      const peers = Object.values(useNet.getState().peers);
      if (!peers.length) return ["no other sessions on the mesh — open this page in a second tab"];
      return peers.map((p) => `  ${p.id.slice(0, 6)} ${p.user.padEnd(12)} ${p.role.padEnd(6)} app:${p.app} ${p.sharing ? "[sharing]" : ""}`);
    }
    case "msg": case "say": {
      if (!rest) return ["usage: msg <text>"];
      sendChat(rest);
      return ["broadcast sent"];
    }
    case "cloak": {
      const id = (args[0] || "none").toLowerCase();
      const c = CLOAKS.find((x) => x.id === (id === "off" ? "none" : id));
      if (!c) return ["cloaks: " + CLOAKS.map((x) => x.id).join(", ")];
      setS({ cloak: c.id });
      return [`tab cloak → ${c.name}`];
    }
    case "panic": ui.setStealth(true); return ["stealth engaged — Shift+S to return"];
    case "lock": ui.setLocked(true); return ["session locked"];
    case "share": openApp("share"); return ["screen link opened"];
    case "wallpaper": setS({ wallpaper: "" }); return ["wallpaper cleared"];
    case "export": {
      download(`singularity-${os.session}-backup.json`, os.exportDB(), "application/json");
      return ["backup downloaded"];
    }
    case "reset": {
      if (args[0] !== "settings") return ["usage: reset settings"];
      os.resetSettings(); return ["modules restored to defaults"];
    }
    case "fortune": return [pick(FORTUNES)];
    case "cowsay": {
      const t = rest || "moo";
      return [" " + "_".repeat(t.length + 2), `< ${t} >`, " " + "-".repeat(t.length + 2), "        \\   ^__^", "         \\  (oo)\\_______", "            (__)\\       )\\/\\", "                ||----w |", "                ||     ||"];
    }
    case "echo": return [rest];
    case "date": return [new Date().toString()];
    case "sudo": return ["nice try. permission model says: you already own this machine."];
    case "exit": ui.close("terminal"); return [];
    default:
      return [`command not found: ${cmd} — type "help"`];
  }
}

export function quickToast(msg: string) { toast(msg); }
