import { useEffect, useState } from "react";
import { useScope } from "../store/scopeStore";
import { useAccent } from "../hooks/useAccent";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { Header } from "../components/terminal/Header";
import { SubBar } from "../components/terminal/SubBar";
import { Footer } from "../components/terminal/Footer";
import { TaskList } from "../components/terminal/TaskList";
import { IntakeScreen } from "../components/intake/IntakeScreen";
import { TaskReview } from "../components/intake/TaskReview";
import { EndDayFlow } from "../components/wrapup/EndDayFlow";
import { FxProvider } from "../components/animations/FX";
import { Reticle } from "../components/ui/Reticle";
import { LoginGate } from "../components/auth/LoginGate";
import { SetupGate } from "../components/auth/SetupGate";
import { SettingsPanel } from "../components/settings/SettingsPanel";
import { bridge } from "../services/bridge";
import type { ParsedTask } from "../types";

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
  const activeTaskId = useScope((s) => s.activeTaskId);
  const bootSession = useScope((s) => s.bootSession);
  const load = useScope((s) => s.load);
  const startTask = useScope((s) => s.startTask);
  const stopTask = useScope((s) => s.stopTask);

  const [endDayOpen, setEndDayOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const [parsedDraft, setParsedDraft] = useState<ParsedTask[] | null>(null);
  // Allow user to force intake (re-upload) even when tasks already exist
  const [forceIntake, setForceIntake] = useState(false);

  useEffect(() => {
    (async () => {
      const me = await bootSession();
      if (me.authed) await load();
      setBooted(true);
    })();
  }, [bootSession, load]);

  useEffect(() => {
    const onUnauth = async () => {
      await bootSession();
    };
    window.addEventListener("scope:unauthorized", onUnauth);
    return () => window.removeEventListener("scope:unauthorized", onUnauth);
  }, [bootSession]);

  // Keyboard shortcuts (only when actually on the active day view)
  useKeyboardShortcuts({
    onNewTask: () => setQuickAddOpen((v) => !v),
    onEndDay: () => tasks.length > 0 && setEndDayOpen(true),
    onToggleActive: () => {
      if (activeTaskId) {
        stopTask(activeTaskId);
      } else {
        const next = tasks.find((t) => t.status === "QUEUED");
        if (next) startTask(next.id);
      }
    },
  });

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

  // Routing: intake (no tasks) → review (parsed draft) → active day
  const showReview = parsedDraft !== null;
  const showIntake = !showReview && (tasks.length === 0 || forceIntake);

  return (
    <div className="app-shell relative flex flex-col h-screen overflow-hidden">
      <div className="app-bg" />
      <div className="app-noise" />
      <div className="app-scanline" />
      <div className="app-vignette" />

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <Header />
        <SubBar
          onSettings={() => setSettingsOpen(true)}
          onEndDay={() => setEndDayOpen(true)}
          onLock={async () => {
            await bridge.auth.logout();
            await bootSession();
          }}
        />

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col">
          {showReview ? (
            <TaskReview
              parsed={parsedDraft!}
              onCancel={() => setParsedDraft(null)}
              onDeployed={() => {
                setParsedDraft(null);
                setForceIntake(false);
              }}
            />
          ) : showIntake ? (
            <IntakeScreen
              onParsed={(parsed) => {
                setParsedDraft(parsed);
                setForceIntake(false);
              }}
            />
          ) : (
            <TaskList />
          )}
        </div>

        {/* Footer — different content depending on screen */}
        {showIntake || showReview ? (
          <IntakeFooter
            currentStep={showReview ? "review" : "acquire"}
            showBack={!showReview && tasks.length > 0}
            onBack={() => setForceIntake(false)}
          />
        ) : (
          <Footer quickAddOpen={quickAddOpen} setQuickAddOpen={setQuickAddOpen} />
        )}
      </div>

      <EndDayFlow open={endDayOpen} onClose={() => setEndDayOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function IntakeFooter({
  currentStep,
  showBack,
  onBack,
}: {
  currentStep: "acquire" | "review";
  showBack: boolean;
  onBack: () => void;
}) {
  return (
    <div className="px-8 py-3 border-t border-white/[0.04] grid grid-cols-3 items-center mono text-[10px] tracking-widest2 uppercase text-muted">
      <div>SCOPE · intake</div>
      <div className="flex items-center justify-center gap-2">
        <Step active={currentStep === "acquire"} label="acquire" />
        <span className="text-muted-deep">→</span>
        <Step active={currentStep === "review"} label="review" />
        <span className="text-muted-deep">→</span>
        <Step label="run day" />
      </div>
      <div className="flex justify-end">
        {showBack && (
          <button
            onClick={onBack}
            className="text-muted hover:text-cream-dim px-2 py-1"
          >
            ← back to day
          </button>
        )}
      </div>
    </div>
  );
}

function Step({ active, label }: { active?: boolean; label: string }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-[2px] ${
        active
          ? "text-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb)/0.08)] border border-[rgb(var(--accent-rgb)/0.3)]"
          : "text-muted"
      }`}
    >
      {label}
    </span>
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
