import { useEffect, useRef, useState } from "react";
import { MonitorUp, Square, Radio, Circle, Camera, PictureInPicture2, Users, Info, Maximize2 } from "lucide-react";
import { useNet, sendFrame, setSharing as setNetSharing } from "@/lib/net";
import { useIsAdmin } from "@/state/store";
import { useUI, toast } from "@/state/ui";
import { Btn, Card, Slider, Toggle, Stat, Empty } from "@/ui/kit";
import { cn, download, relTime } from "@/lib/utils";

export default function ShareApp() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<number | undefined>(undefined);

  const [live, setLive] = useState(false);
  const [broadcast, setBroadcast] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fps, setFps] = useState(4);
  const [width, setWidth] = useState(560);
  const [sent, setSent] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const [res, setRes] = useState("—");

  const peers = useNet((n) => n.peers);
  const frames = useNet((n) => n.frames);
  const isAdmin = useIsAdmin();
  const viewers = Object.values(peers).filter((p) => p.role === "admin").length;
  const incoming = Object.values(peers).filter((p) => p.sharing);

  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [live]);

  const stop = () => {
    window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    setLive(false); setBroadcast(false); setRecording(false); setNetSharing(false); setRes("—");
    useUI.getState().setVisionState({ active: false, res: "—" });
  };

  useEffect(() => () => { stop(); }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast("Screen capture unavailable", "This browser or context does not allow getDisplayMedia", "bad");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 20 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => undefined); }
      const track = stream.getVideoTracks()[0];
      const st = track.getSettings();
      const resStr = `${st.width ?? "?"}×${st.height ?? "?"}`;
      setRes(resStr);
      track.addEventListener("ended", stop);
      setLive(true); setSeconds(0); setSent(0);
      useUI.getState().setVisionState({ active: true, res: resStr });
      toast("Screen linked", "KALMIA Vision & Mesh Broadcast ready", "ok");
    } catch {
      toast("Capture cancelled", undefined, "warn");
    }
  };

  useEffect(() => {
    window.clearInterval(timerRef.current);
    setNetSharing(live && broadcast);
    if (!live) return;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    timerRef.current = window.setInterval(() => {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || !v.videoWidth) return;
      const scale = width / v.videoWidth;
      c.width = width; c.height = Math.round(v.videoHeight * scale);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.45);
      useUI.getState().setVisionState({ active: true, frame: data });
      if (broadcast) {
        sendFrame(data);
        setSent((s) => s + data.length);
      }
    }, Math.max(80, 1000 / fps));
    return () => window.clearInterval(timerRef.current);
  }, [live, broadcast, fps, width]);

  const record = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (recording) { recRef.current?.stop(); return; }
    try {
      const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
      const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: "video/webm" });
        download(`singularity-capture-${Date.now()}.webm`, blob);
        setRecording(false);
        toast("Recording saved", `${(blob.size / 1048576).toFixed(1)} MB webm`, "ok");
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      toast("Recording started", undefined, "ok");
    } catch {
      toast("Recording not supported here", undefined, "bad");
    }
  };

  const snapshot = () => {
    const v = videoRef.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    download(`snapshot-${Date.now()}.png`, dataBlob(c.toDataURL("image/png")));
    toast("Snapshot saved", undefined, "ok");
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto p-4">
      <div className="flex flex-wrap gap-4">
        <div className="min-w-[280px] flex-[2]">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-black/60">
            <video ref={videoRef} muted playsInline className={cn("h-full w-full object-contain", !live && "opacity-0")} />
            {!live && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <MonitorUp size={34} className="mx-auto mb-3 text-accent2" />
                  <div className="font-display text-base font-semibold text-txt">Link a screen, window or tab</div>
                  <p className="mx-auto mt-1 max-w-xs text-[11px] leading-relaxed text-faint">
                    Your browser will ask which surface to capture. Nothing leaves this machine unless you enable Broadcast.
                  </p>
                  <Btn variant="primary" className="mt-4" icon={<MonitorUp size={14} />} onClick={start}>Choose source</Btn>
                </div>
              </div>
            )}
            {live && (
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-txt">
                  <span className={cn("h-1.5 w-1.5 rounded-full", broadcast ? "bg-bad anim-blink" : "bg-ok")} />
                  {broadcast ? "on air" : "preview"}
                </span>
                {recording && <span className="flex items-center gap-1.5 rounded-full bg-bad/90 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-black"><Circle size={8} fill="currentColor" /> rec</span>}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {!live
              ? <Btn variant="primary" icon={<MonitorUp size={14} />} onClick={start}>Start capture</Btn>
              : <Btn variant="danger" icon={<Square size={13} />} onClick={stop}>Stop</Btn>}
            <Btn icon={<Camera size={13} />} onClick={snapshot} disabled={!live}>Snapshot</Btn>
            <Btn icon={<Circle size={13} />} onClick={record} disabled={!live} variant={recording ? "danger" : "outline"}>{recording ? "Stop recording" : "Record"}</Btn>
            <Btn icon={<PictureInPicture2 size={13} />} disabled={!live}
              onClick={async () => { try { await videoRef.current?.requestPictureInPicture(); } catch { toast("Picture-in-picture blocked", undefined, "warn"); } }}>
              PiP
            </Btn>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="source" value={res} />
            <Stat label="uptime" value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`} />
            <Stat label="viewers" value={broadcast ? viewers : 0} tone="var(--accent-2)" sub="admin sessions" />
            <Stat label="pushed" value={(sent / 1048576).toFixed(1) + " MB"} />
          </div>
        </div>

        <div className="min-w-[240px] flex-1">
          <Card className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-txt"><Radio size={13} className="text-accent" /> Broadcast to mesh</span>
              <Toggle on={broadcast} onChange={(v) => { if (!live && v) { toast("Start a capture first", undefined, "warn"); return; } setBroadcast(v); }} label="Broadcast" />
            </div>
            <p className="mb-3 text-[10px] leading-relaxed text-faint">
              Frames are pushed over a BroadcastChannel to every other Singularity tab on this machine. Admins see them live in Overwatch.
            </p>
            <Slider label="Frame rate" value={fps} min={1} max={12} unit=" fps" onChange={setFps} />
            <Slider label="Frame width" value={width} min={240} max={1280} step={40} unit=" px" onChange={setWidth} />
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-txt"><Users size={13} className="text-accent2" /> Incoming feeds <span className="ml-auto font-mono text-[10px] text-faint">{incoming.length}</span></div>
            {incoming.length === 0 ? (
              <Empty title="No one is sharing" hint={isAdmin ? "Ask a session to share from Overwatch → Remote control." : "Open a second tab, sign in, and start a capture there."} />
            ) : (
              <div className="grid gap-2">
                {incoming.map((p) => {
                  const f = frames[p.id];
                  return (
                    <button key={p.id} onClick={() => setZoom(p.id)} className="group overflow-hidden rounded-lg border border-line text-left transition hover:border-accent">
                      <div className="relative aspect-video bg-black/60">
                        {f ? <img src={f.data} alt={`${p.user} screen`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-faint">waiting for frames…</div>}
                        <Maximize2 size={13} className="absolute right-2 top-2 text-white/70 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="font-mono text-[10px] text-txt">{p.user}</span>
                        <span className="font-mono text-[9px] text-faint">{f ? relTime(f.ts) : "—"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="mt-3 flex gap-2 rounded-xl border border-line bg-white/[0.02] p-3">
            <Info size={14} className="mt-0.5 shrink-0 text-accent2" />
            <p className="text-[10px] leading-relaxed text-faint">
              Capture always requires the browser's own permission prompt — it can never be started silently, by NOVA, or by an admin.
            </p>
          </div>
        </div>
      </div>

      {zoom && frames[zoom] && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/85 p-6" onClick={() => setZoom(null)}>
          <img src={frames[zoom].data} alt="Remote screen" className="max-h-full max-w-full rounded-xl border border-line2" />
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">click anywhere to close</div>
        </div>
      )}
    </div>
  );
}

function dataBlob(d: string) {
  const [h, b] = d.split(","); const mime = h.match(/:(.*?);/)?.[1] || "image/png";
  const bin = atob(b); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: mime });
}
