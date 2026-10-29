import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import BootError from "./BootError";

/** Removes the pre-boot shell once React has painted its first frame. */
function clearBootShell() {
  const w = window as unknown as { __sglrReady?: () => void };
  if (typeof w.__sglrReady === "function") w.__sglrReady();
  else document.getElementById("sglr-boot")?.classList.add("gone");
}

function mount() {
  const host = document.getElementById("root");
  if (!host) return;
  try {
    const root = createRoot(host);
    root.render(
      <StrictMode>
        <BootError>
          <App />
        </BootError>
      </StrictMode>
    );
    requestAnimationFrame(() => requestAnimationFrame(clearBootShell));
    // Safety net in case rAF is throttled in a background tab.
    window.setTimeout(clearBootShell, 2500);
  } catch (err) {
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    host.innerHTML = "";
    const pre = document.createElement("pre");
    pre.style.cssText =
      "position:fixed;inset:24px;overflow:auto;padding:20px;border-radius:14px;background:#12070c;color:#ffb3c1;border:1px solid rgba(255,77,109,.45);font:12px/1.6 ui-monospace,monospace;white-space:pre-wrap";
    pre.textContent = "Singularity OS failed to mount.\n\n" + message + "\n\nTry: Reset local data, then reload.";
    host.appendChild(pre);
    const btn = document.createElement("button");
    btn.textContent = "Reset local data & reload";
    btn.style.cssText =
      "position:fixed;left:24px;bottom:24px;padding:10px 16px;border-radius:10px;border:1px solid #ff9f45;background:#ff9f45;color:#0a0a0c;font:600 12px ui-monospace,monospace;cursor:pointer";
    btn.onclick = () => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* blocked */ }
      location.reload();
    };
    host.appendChild(btn);
    clearBootShell();
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
