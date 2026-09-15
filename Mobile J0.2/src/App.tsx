import { useEffect } from "react";
import { useApp } from "./context/AppContext";
import { setBackButton } from "./lib/telegram";
import { Header } from "./components/Header";
import { HomeScreen } from "./screens/HomeScreen";
import { TalkScreen } from "./screens/TalkScreen";
import { TasksScreen } from "./screens/TasksScreen";
import { ProfileScreen } from "./screens/ProfileScreen";

export function App() {
  const { booting, authError, actionError, dismissActionError, screen, goHome } = useApp();

  useEffect(() => {
    return setBackButton(screen !== "home", goHome);
  }, [screen, goHome]);

  if (booting) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface)", color: "var(--color-neutral-600)", fontSize: 13 }}>
        Signing in…
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--color-surface)", padding: 24, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>Couldn't sign you in</span>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>{authError}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        fontFamily: "var(--font-body)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Header />
      {actionError && (
        <div
          onClick={dismissActionError}
          style={{
            flex: "none",
            padding: "10px 14px",
            fontSize: 12,
            background: "var(--color-accent-100)",
            color: "var(--color-accent-700)",
            cursor: "pointer",
          }}
        >
          {actionError} · tap to dismiss
        </div>
      )}
      {screen === "home" && <HomeScreen />}
      {screen === "talk" && <TalkScreen />}
      {screen === "tasks" && <TasksScreen />}
      {screen === "profile" && <ProfileScreen />}
    </div>
  );
}

export default App;
