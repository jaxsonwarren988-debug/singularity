import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldHalf, ArrowRight, Trash2, UserRound, KeyRound, Cpu, Radio, Orbit } from "lucide-react";
import { useOS } from "@/state/store";
import { toast } from "@/state/ui";
import { cn, relTime } from "@/lib/utils";
import { audio } from "@/lib/audio";

type Mode = "login" | "signup" | "admin";

const TICKER = [
  "mounting local account vault",
  "compiling 12 fragment shaders",
  "opening mesh broadcast channel",
  "calibrating event horizon",
  "indexing arcade catalogue",
  "NOVA intent engine online",
];

export default function Auth() {
  const os = useOS();
  const [mode, setMode] = useState<Mode>("login");
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const a = setInterval(() => setTick((t) => (t + 1) % TICKER.length), 2200);
    const b = setInterval(() => setClock(new Date()), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const accounts = Object.values(os.db.users).filter((u) => u.name !== "admin");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setErr(""); setBusy(true);
    audio.blip(660, 0.05, 0.03);
    try {
      let error: string | null = null;
      if (mode === "login") error = await os.login(user, pw);
      else if (mode === "signup") {
        if (pw !== pw2) error = "Passwords do not match";
        else error = await os.signup(user, pw);
      } else error = await os.loginAdmin(pw);
      if (error) { setErr(error); audio.blip(160, 0.14, 0.05, "sawtooth"); }
      else toast(mode === "signup" ? "Account created" : "Welcome back", mode === "admin" ? "Administrator session" : user.toLowerCase(), "ok");
    } finally { setBusy(false); }
  };

  const guest = async () => {
    setBusy(true);
    const exists = os.db.users["guest"];
    const error = exists ? await os.login("guest", "guest") : await os.signup("guest", "guest");
    if (error) setErr(error);
    setBusy(false);
  };

  return (
    <div className="relative z-20 flex h-full w-full flex-col overflow-y-auto lg:flex-row">
      {/* identity panel */}
      <div className="relative flex flex-1 flex-col justify-between p-7 lg:p-12">
        <div className="flex items-center gap-3">
          <span className="relative grid h-9 w-9 place-items-center">
            <span className="absolute inset-0 rounded-full border border-accent/70" />
            <span className="spin-slow absolute -inset-1 rounded-full border border-dashed border-accent2/50" />
            <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_16px_var(--accent)]" />
          </span>
          <div>
            <div className="font-display text-[15px] font-bold uppercase tracking-[0.3em] text-txt">Singularity</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-faint">operating environment · 6.0</div>
          </div>
        </div>

        <div className="my-10 max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-ok anim-blink" /> local-first · no server · no telemetry
          </div>
          <h1 className="font-display text-[clamp(40px,7.5vw,86px)] font-bold leading-[0.88] tracking-[-0.02em] text-txt">
            A whole OS<br />
            <span style={{ color: "var(--accent)" }} className="text-glow">in one tab.</span>
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-dim">
            Twelve GPU shaders. Twelve applications. A live mesh between your windows, an assistant with root access,
            and an admin console that can see and steer every session.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: Cpu, label: "12 shaders" },
              { icon: Orbit, label: "idle reactor" },
              { icon: Radio, label: "tab mesh" },
              { icon: ShieldHalf, label: "overwatch" },
            ].map((f) => (
              <span key={f.label} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
                <f.icon size={11} className="text-accent" />{f.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">
            <span className="text-accent">›</span> {TICKER[tick]}
            <span className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 bg-accent anim-blink" />
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold text-txt tabular">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-faint">{clock.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</div>
          </div>
        </div>
      </div>

      {/* auth card */}
      <div className="flex w-full items-center justify-center p-5 lg:w-[440px] lg:p-8">
        <div className="surface anim-rise w-full rounded-2xl p-6">
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-line bg-white/[0.03] p-1">
            {(["login", "signup", "admin"] as Mode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }}
                className={cn("rounded-lg py-2 font-mono text-[10px] uppercase tracking-[0.16em] transition-all",
                  mode === m ? (m === "admin" ? "bg-bad/15 text-bad" : "bg-accent/15 text-accent") : "text-faint hover:text-dim")}>
                {m === "login" ? "log in" : m === "signup" ? "sign up" : "admin"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-2.5">
            {mode !== "admin" && (
              <label className="relative block">
                <UserRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="handle" autoComplete="username"
                  spellCheck={false} className="field py-3 pl-9" />
              </label>
            )}
            <label className="relative block">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input value={pw} onChange={(e) => setPw(e.target.value)} type={show ? "text" : "password"}
                placeholder={mode === "admin" ? "administrator key" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"} className="field py-3 pl-9 pr-10" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint transition hover:text-accent">
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </label>
            {mode === "signup" && (
              <input value={pw2} onChange={(e) => setPw2(e.target.value)} type={show ? "text" : "password"} placeholder="confirm password" className="field py-3" />
            )}

            <div className={cn("min-h-[16px] font-mono text-[10px] text-bad", err && "anim-shake")}>{err}</div>

            <button type="submit" disabled={busy}
              className={cn("group flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[12px] font-bold uppercase tracking-[0.22em] transition-all active:scale-[0.98] disabled:opacity-60",
                mode === "admin" ? "bg-bad text-[#0a0a0c]" : "bg-accent text-[#0a0a0c]")}>
              {busy ? "authenticating…" : mode === "signup" ? "create account" : mode === "admin" ? "enter overwatch" : "enter"}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {mode === "admin" ? (
            <p className="mt-3 rounded-lg border border-bad/30 bg-bad/[0.07] px-3 py-2 font-mono text-[10px] leading-relaxed text-dim">
              default root key: <b className="text-bad">Kioto</b> — change it in Overwatch → Accounts after signing in.
            </p>
          ) : (
            <button onClick={guest} className="mt-3 w-full rounded-xl border border-line py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-dim transition hover:border-accent hover:text-accent">
              continue as guest
            </button>
          )}

          {accounts.length > 0 && mode !== "admin" && (
            <>
              <div className="my-4 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.2em] text-faint">
                <span className="h-px flex-1 bg-line" />saved accounts<span className="h-px flex-1 bg-line" />
              </div>
              <div className="scroll-thin flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                {accounts.map((a) => (
                  <div key={a.name} className="group flex items-center gap-2.5 rounded-xl border border-line bg-white/[0.02] px-3 py-2 transition hover:border-accent/50">
                    <button onClick={() => { setMode("login"); setUser(a.name); setPw(""); }} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg font-display text-[12px] font-bold" style={{ background: `${a.color}22`, color: a.color }}>
                        {a.name[0].toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] text-txt">{a.name}</span>
                        <span className="block font-mono text-[9px] text-faint">{a.seen ? "seen " + relTime(a.seen) : "never signed in"}</span>
                      </span>
                    </button>
                    <button title="Delete account" onClick={() => { os.adminDelete(a.name); toast("Account deleted", a.name, "warn"); }}
                      className="shrink-0 text-faint opacity-0 transition hover:text-bad group-hover:opacity-100"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="mt-4 text-center font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-faint">
            accounts live in this browser only<br />each tab keeps its own session
          </p>
        </div>
      </div>
    </div>
  );
}
