import { useEffect, useState } from "react";
import { useScope } from "../store/scopeStore";
import { useAccent } from "../hooks/useAccent";
import { Header } from "../components/terminal/Header";
import { TaskList } from "../components/terminal/TaskList";
import { ScheduleUpload } from "../components/wrapup/ScheduleUpload";
import { EndDayFlow } from "../components/wrapup/EndDayFlow";
import { FxProvider } from "../components/animations/FX";
import { Reticle } from "../components/ui/Reticle";
import { ViewfinderMarks } from "../components/ui/ViewfinderMarks";
import { LoginGate } from "../components/auth/LoginGate";
import { SetupGate } from "../components/auth/SetupGate";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { bridge } from "../services/bridge";

export function App() {
  return (
    <FxProvider>
      <Shell />
    </FxProvider>
  );
}

function Shell() {
  useAccent();
  const loaded = useScope((s) => s.loaded);
  const authed = useScope((s) => s.authed);
  const firstRun = useScope((s) => s.firstRun);
  const day = useScope((s) => s.day);
  const tasks = useScope((s) => s.tasks);
  const hasApiKey = useScope((s) => s.hasApiKey);
  const bootSession = useScope((s) => s.bootSession);
  const load = useScope((s) => s.load);
  const addTasksFromParse = useScope((s) => s.addTasksFromParse);
  const [endDayOpen, setEndDayOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [booted, setBooted] = useState(false);

  // Boot: check session, load day if authed.
  useEffect(() => {
    (async () => {
      const me = await bootSession();
      if (me.authed) await load();
      setBooted(true);
    })();
  }, [bootSession, load]);

  // Listen for 401s from in-flight requests (e.g. cookie expired mid-session).
  useEffect(() => {
    const onUnauth = async () => {
      await bootSession();
    };
    window.addEventListener("scope:unauthorized", onUnauth);
    return () => window.removeEventListener("scope:unauthorized", onUnauth);
  }, [bootSession]);

  if (!booted) return <Boot />;

  if (firstRun) {
    return (
      <SetupGate
        onComplete={async () => {
          await bootSession();
          await load();
        }}
      />
    );
  }

  if (!authed) {
    return (
      <LoginGate
        onAuthed={async () => {
          await bootSession();
          await load();
        }}
      />
    );
  }

  if (!loaded || !day) return <Boot />;

  const allCleared =
    tasks.length > 0 && tasks.every((t) => t.status === "DONE" || t.status === "SKIPPED");
  const canEndDay = tasks.length > 0;

  return (
    <div className="app-shell relative flex flex-col h-full min-h-screen">
      <div className="app-bg" />
      <div className="app-noise" />
      <div className="app-scanline" />
      <div className="app-vignette" />

      <div className="relative z-10 flex flex-col h-screen min-h-0">
        <Header />

        {/* Top bar — upload schedule + status */}
        <div className="px-8 pb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="mono text-[10px] tracking-widest2 uppercase text-cream-dim hover:text-cream-bright px-2.5 py-1 border border-white/10 hover:border-white/30 rounded-[2px]"
            >
              {showUpload ? "✕ close intake" : "intake schedule"}
            </button>
            {!hasApiKey && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="mono text-[10px] tracking-widest2 uppercase text-tier-high hover:text-cream-bright"
              >
                · no api key — add in settings
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-2 py-1"
              title="Settings"
            >
              SETTINGS
            </button>
            <button
              onClick={async () => {
                await bridge.auth.logout();
                await bootSession();
              }}
              className="mono text-[10px] tracking-widest2 uppercase text-muted hover:text-cream-dim px-2 py-1"
              title="Lock"
            >
              LOCK
            </button>
            <button
              disabled={!canEndDay}
              onClick={() => setEndDayOpen(true)}
              className={`relative mono text-[11px] tracking-widest2 uppercase px-4 py-2 rounded-[2px] border
                          ${allCleared
                            ? "border-[rgb(var(--accent-rgb)/0.7)] text-[rgb(var(--accent-rgb))] animate-[pulseGlow_2.4s_ease-in-out_infinite] bg-[rgb(var(--accent-rgb)/0.04)]"
                            : "border-white/15 text-cream-dim hover:text-cream-bright hover:border-white/30"} disabled:opacity-30 disabled:pointer-events-none`}
            >
              END DAY
            </button>
          </div>
        </div>

        {showUpload && (
          <div className="px-8 pb-3">
            <ScheduleUpload
              compact
              onParsed={async (parsed) => {
                await addTasksFromParse(parsed);
                setShowUpload(false);
              }}
            />
          </div>
        )}

        <TaskList />

        {/* Footer */}
        <div className="relative px-8 py-3 border-t border-white/[0.04] flex items-center justify-between mono text-[10px] tracking-widest2 uppercase text-muted">
          <ViewfinderMarks inset={4} opacity={0.18} />
          <div>SCOPE · operator console</div>
          <div className="flex items-center gap-4">
            <span>v0.1</span>
            <span>·</span>
            <span>{day.date}</span>
          </div>
        </div>
      </div>

      <EndDayFlow open={endDayOpen} onClose={() => setEndDayOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Boot() {
  return (
    <div className="app-shell relative flex flex-col items-center justify-center h-screen text-cream">
      <div className="app-bg" />
      <div className="app-noise" />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Reticle size={36} />
        <div className="label-eyebrow">SCOPE · INITIALIZING</div>
        <div className="mono text-xs text-muted">loading day state</div>
      </div>
    </div>
  );
}
