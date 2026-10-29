import { Command, Keyboard, Layers, Radio, Sparkles, ShieldHalf, Gamepad2 } from "lucide-react";
import { Section, Card } from "@/ui/kit";
import { APPS } from "@/os/apps/meta";
import { useUI } from "@/state/ui";

const KEYS: [string, string][] = [
  ["⌘ / Ctrl + K", "Open the command deck (search apps, themes, shaders, actions)"],
  ["Shift + S", "Panic — instant stealth screen, press again to return"],
  ["Shift + L", "Lock this session"],
  ["Shift + T", "Open the terminal"],
  ["Shift + M", "Open Modules"],
  ["Shift + A", "Ask NOVA"],
  ["Shift + W", "Close the focused window"],
  ["Esc", "Close the command deck / dialogs"],
  ["Double-click title bar", "Maximise or restore a window"],
  ["Drag bottom-right corner", "Resize a window"],
];

export default function HelpApp() {
  const open = useUI((u) => u.open);
  return (
    <div className="scroll-thin h-full overflow-y-auto p-5">
      <div className="mb-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">field manual · build 6.0</div>
        <h2 className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-txt">Singularity OS</h2>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-dim">
          A browser-native desktop: eighteen GPU shaders, twelve applications, twelve native games, a mesh network between your tabs,
          and an assistant that can actually drive the machine. Everything you change is written to local storage the moment you change it.
        </p>
      </div>

      <Section title="Keyboard" hint="Shortcuts work anywhere except inside a text field">
        <div className="grid gap-1.5 sm:grid-cols-2">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-start gap-3 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
              <kbd className="shrink-0 rounded-md border border-line2 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-accent">{k}</kbd>
              <span className="text-[11px] leading-snug text-dim">{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Applications">
        <div className="grid gap-2 sm:grid-cols-2">
          {APPS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.id} onClick={() => open(a.id)} className="flex items-start gap-2.5 rounded-xl border border-line bg-white/[0.02] p-2.5 text-left transition hover:border-accent/50 hover:bg-accent/[0.06]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${a.tint} 16%, transparent)`, color: a.tint }}><Icon size={15} /></span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-txt">{a.name}</span>
                  <span className="block text-[10px] leading-snug text-faint">{a.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="How the mesh works">
        <Card>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-txt"><Radio size={14} className="text-accent2" /> Same browser, many sessions</div>
          <p className="text-[11px] leading-relaxed text-dim">
            Each tab keeps its own signed-in session, and all tabs talk over a BroadcastChannel. Open a second window, sign in as a different
            account, and it appears in <b className="text-txt">Overwatch → Live screens</b>. From there an admin can watch a broadcast, push themes and
            shaders, open apps, fire the reactor, lock, freeze or sign a session out.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-faint">
            Screen capture is the one thing nobody can trigger for you: the browser always shows its own picker to the person sharing.
            There is no server here — nothing leaves this machine.
          </p>
        </Card>
      </Section>

      <Section title="Good to know">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { icon: Layers, title: "18 shaders · 16 themes", body: "Switch renderers live in Modules → Renderer. Four light themes included. Quality scales resolution if your GPU struggles." },
            { icon: Sparkles, title: "KALMIA acts", body: "Agent mode plans a task, then a visible cursor clicks real buttons. Chat mode answers and writes. Cloud model optional." },
            { icon: ShieldHalf, title: "Admin key", body: "The root account is admin / Kioto. Change it in Overwatch → Accounts once you're in." },
            { icon: Command, title: "Everything saves", body: "Settings, reactor progress, notes, tasks, chat and window positions persist per account." },
            { icon: Keyboard, title: "Terminal first", body: "Almost every UI action has a shell command. Type help to see all of them." },
            { icon: Gamepad2, title: "Game sources", body: "Catalogue mirrors are curated from github.com/bns34/Unblocked-Sites. Built-in games are compiled in." },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title}>
                <Icon size={15} className="mb-1.5 text-accent" />
                <div className="text-[12px] font-semibold text-txt">{c.title}</div>
                <div className="mt-1 text-[10px] leading-relaxed text-faint">{c.body}</div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
