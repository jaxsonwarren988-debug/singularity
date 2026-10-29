import { useMemo, useState } from "react";
import { Plus, Search, Pin, Trash2, Download, StickyNote, CheckSquare, Circle, CheckCircle2, Flag } from "lucide-react";
import { useOS, useProfile, type Note } from "@/state/store";
import { toast } from "@/state/ui";
import { Btn, IconBtn, Empty, Chips } from "@/ui/kit";
import { cn, uid, download, relTime } from "@/lib/utils";

export default function NotesApp() {
  const prof = useProfile();
  const update = useOS((s) => s.updateProfile);
  const [tab, setTab] = useState<"notes" | "tasks">("notes");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(prof.notes[0]?.id ?? null);
  const [draft, setDraft] = useState("");

  const notes = useMemo(() => {
    const list = prof.notes.filter((n) => (n.title + n.body + n.tag).toLowerCase().includes(q.toLowerCase()));
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts);
  }, [prof.notes, q]);
  const active = prof.notes.find((n) => n.id === activeId) || null;

  const patch = (id: string, p: Partial<Note>) =>
    update((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...p, ts: Date.now() } : n)) }));

  const addNote = () => {
    const n: Note = { id: uid(), title: "Untitled note", body: "", tag: "personal", pinned: false, ts: Date.now() };
    update((s) => ({ ...s, notes: [n, ...s.notes] }));
    setActiveId(n.id);
  };

  const addTask = () => {
    if (!draft.trim()) return;
    update((s) => ({ ...s, todos: [{ id: uid(), text: draft.trim(), done: false, pri: 1, ts: Date.now() }, ...s.todos] }));
    setDraft("");
  };

  const done = prof.todos.filter((t) => t.done).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <div className="w-52"><Chips options={[{ v: "notes", label: `Notes ${prof.notes.length}` }, { v: "tasks", label: `Tasks ${done}/${prof.todos.length}` }]} value={tab} onChange={setTab} cols={2} /></div>
        <div className="relative min-w-0 flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the vault" className="field py-1.5 pl-8 text-[12px]" />
        </div>
        {tab === "notes" && <Btn size="xs" variant="primary" icon={<Plus size={13} />} onClick={addNote}>New</Btn>}
      </div>

      {tab === "notes" ? (
        <div className="flex min-h-0 flex-1">
          <div className="scroll-thin w-[210px] shrink-0 overflow-y-auto border-r border-line bg-black/20 p-1.5">
            {notes.length === 0 && <div className="p-3 text-[11px] text-faint">No notes match.</div>}
            {notes.map((n) => (
              <button key={n.id} onClick={() => setActiveId(n.id)}
                className={cn("mb-1 block w-full rounded-lg border px-2.5 py-2 text-left transition-all",
                  activeId === n.id ? "border-accent/50 bg-accent/10" : "border-transparent hover:bg-white/[0.05]")}>
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin size={10} className="shrink-0 text-warn" />}
                  <span className="truncate text-[12px] font-medium text-txt">{n.title || "Untitled"}</span>
                </div>
                <div className="truncate text-[10px] text-faint">{n.body.slice(0, 40) || "empty"}</div>
                <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-faint">{n.tag} · {relTime(n.ts)}</div>
              </button>
            ))}
          </div>
          {active ? (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <input value={active.title} onChange={(e) => patch(active.id, { title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent font-display text-[15px] font-semibold text-txt outline-none" />
                <input value={active.tag} onChange={(e) => patch(active.id, { tag: e.target.value })}
                  className="w-24 rounded border border-line bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-accent outline-none" />
                <IconBtn label="Pin note" active={active.pinned} onClick={() => patch(active.id, { pinned: !active.pinned })}><Pin size={14} /></IconBtn>
                <IconBtn label="Export note" onClick={() => download(`${active.title || "note"}.md`, `# ${active.title}\n\n${active.body}`)}><Download size={14} /></IconBtn>
                <IconBtn label="Delete note" onClick={() => { update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== active.id) })); setActiveId(null); toast("Note deleted", undefined, "warn"); }}><Trash2 size={14} /></IconBtn>
              </div>
              <textarea value={active.body} onChange={(e) => patch(active.id, { body: e.target.value })}
                placeholder="Write anything — it saves on every keystroke."
                className="scroll-thin min-h-0 flex-1 resize-none bg-transparent p-4 text-[13px] leading-relaxed text-dim outline-none" />
              <div className="border-t border-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                {active.body.trim() ? active.body.trim().split(/\s+/).length : 0} words · autosaved {relTime(active.ts)}
              </div>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6"><Empty icon={<StickyNote size={26} />} title="Select or create a note" hint="Everything in the vault is stored locally and survives reloads." /></div>
          )}
        </div>
      ) : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a task and press Enter" className="field" />
            <Btn variant="primary" icon={<Plus size={13} />} onClick={addTask}>Add</Btn>
          </div>
          {prof.todos.length === 0 ? <Empty icon={<CheckSquare size={26} />} title="Nothing on the list" hint="Tasks added from the terminal or NOVA land here too." /> : (
            <div className="flex flex-col gap-1.5">
              {prof.todos.filter((t) => (t.text.toLowerCase().includes(q.toLowerCase()))).map((t) => (
                <div key={t.id} className={cn("group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all", t.done ? "border-line/50 bg-white/[0.01] opacity-60" : "border-line bg-white/[0.03]")}>
                  <button onClick={() => update((s) => ({ ...s, todos: s.todos.map((x) => x.id === t.id ? { ...x, done: !x.done } : x) }))} className="shrink-0 text-accent">
                    {t.done ? <CheckCircle2 size={17} /> : <Circle size={17} className="text-faint" />}
                  </button>
                  <input value={t.text} onChange={(e) => update((s) => ({ ...s, todos: s.todos.map((x) => x.id === t.id ? { ...x, text: e.target.value } : x) }))}
                    className={cn("min-w-0 flex-1 bg-transparent text-[13px] outline-none", t.done ? "text-faint line-through" : "text-txt")} />
                  <button title="Cycle priority" onClick={() => update((s) => ({ ...s, todos: s.todos.map((x) => x.id === t.id ? { ...x, pri: ((x.pri + 1) % 3) as 0 | 1 | 2 } : x) }))}
                    className="shrink-0" style={{ color: t.pri === 2 ? "var(--bad)" : t.pri === 1 ? "var(--warn)" : "var(--faint)" }}>
                    <Flag size={13} />
                  </button>
                  <IconBtn label="Delete task" onClick={() => update((s) => ({ ...s, todos: s.todos.filter((x) => x.id !== t.id) }))}><Trash2 size={13} /></IconBtn>
                </div>
              ))}
            </div>
          )}
          {done > 0 && <Btn className="mt-3" size="xs" variant="danger" onClick={() => update((s) => ({ ...s, todos: s.todos.filter((t) => !t.done) }))}>Clear {done} completed</Btn>}
        </div>
      )}
    </div>
  );
}
