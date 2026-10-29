import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null; info: string }

/** Catches render-time crashes so the user gets a recovery panel, never a white screen. */
export default class BootError extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: (info.componentStack || "").slice(0, 900) });
    console.error("[Singularity] render error", error);
  }

  reset = (hard: boolean) => {
    if (hard) {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* blocked */ }
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#07080c", padding: 24, zIndex: 2147483000 }}>
        <div style={{ maxWidth: 620, width: "100%", border: "1px solid rgba(255,77,109,.45)", background: "#12070c", borderRadius: 16, padding: 24 }}>
          <div style={{ font: "700 10px/1 'JetBrains Mono', monospace", letterSpacing: ".28em", textTransform: "uppercase", color: "#ff4d6d" }}>
            kernel exception
          </div>
          <h1 style={{ font: "700 24px/1.2 'Chakra Petch', system-ui, sans-serif", color: "#eef0f6", margin: "10px 0 8px" }}>
            A module crashed — your data is safe
          </h1>
          <p style={{ font: "400 13px/1.65 Outfit, system-ui, sans-serif", color: "rgba(238,240,246,.68)", margin: 0 }}>
            Reload to recover the session. If it keeps happening, reset local data (this clears saved accounts and settings on this device only).
          </p>
          <pre style={{ marginTop: 14, maxHeight: 190, overflow: "auto", padding: 12, borderRadius: 10, background: "rgba(0,0,0,.45)", color: "#ffb3c1", font: "11px/1.55 ui-monospace, monospace", whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
            {this.state.info ? "\n" + this.state.info : ""}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={() => this.reset(false)} style={btnStyle(true)}>Reload</button>
            <button onClick={() => this.reset(true)} style={btnStyle(false)}>Reset local data</button>
          </div>
        </div>
      </div>
    );
  }
}

function btnStyle(primary: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${primary ? "#ff9f45" : "rgba(255,255,255,.2)"}`,
    background: primary ? "#ff9f45" : "transparent",
    color: primary ? "#0a0a0c" : "#eef0f6",
    font: "600 11px 'JetBrains Mono', monospace",
    letterSpacing: ".14em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}
