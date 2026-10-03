import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { RoomProvider, useRoom } from "./context/RoomContext";
import { LandingPage } from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";
import { AuthModal } from "./components/AuthModal";
import { UserNav } from "./components/UserNav";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Helper to extract room code from URL: /room/:roomId
function getRoomCodeFromPath(): string {
  const match = window.location.pathname.match(/\/room\/([A-Za-z0-9_-]+)/i);
  return match ? match[1].toUpperCase() : "";
}

const MainApp: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { roomId, isAutoJoining } = useRoom();
  const [initialRoomCode, setInitialRoomCode] = useState<string>(() => getRoomCodeFromPath());

  useEffect(() => {
    const handlePopState = () => {
      setInitialRoomCode(getRoomCodeFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="app-wrapper">
      <div className="ambient-glow" />
      <ToastContainer />

      {/* Top Header when user is logged in and on the Landing screen */}
      {user && !roomId && (
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 2rem",
            maxWidth: "1280px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>🎬</span>
            <span
              style={{
                fontWeight: 800,
                fontSize: "1.25rem",
                color: "#f8fafc",
                letterSpacing: "-0.02em",
              }}
            >
              Watch<span style={{ color: "var(--accent-primary, #f59e0b)" }}>Party</span>
            </span>
          </div>
          <UserNav />
        </header>
      )}

      {/* Auth session initialization spinner */}
      {isAuthLoading ? (
        <div
          style={{
            minHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "3px solid rgba(245, 158, 11, 0.2)",
              borderTopColor: "var(--accent-primary, #f59e0b)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
              Loading WatchParty...
            </h3>
            <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>
              Verifying authentication session
            </p>
          </div>
        </div>
      ) : !user ? (
        /* Enforce user requirement: only logged in users can join */
        <div
          style={{
            padding: "1.5rem 1rem",
            minHeight: "85vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AuthModal
            title={initialRoomCode ? `Sign in to enter room ${initialRoomCode}` : "Welcome to WatchParty"}
            subtitle={
              initialRoomCode
                ? `You must be signed in to join watch party ${initialRoomCode}.`
                : "Synchronized YouTube cinema. Sign in or create an account to start watching together."
            }
          />
        </div>
      ) : isAutoJoining ? (
        <div
          style={{
            minHeight: "75vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              border: "3px solid rgba(245, 158, 11, 0.2)",
              borderTopColor: "var(--accent-primary, #f59e0b)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
              Reconnecting to Watch Party...
            </h3>
            <p style={{ color: "var(--text-muted, #94a3b8)", fontSize: "0.85rem" }}>
              Restoring your room session and stream state
            </p>
          </div>
        </div>
      ) : roomId ? (
        <RoomPage />
      ) : (
        <LandingPage
          initialRoomCode={initialRoomCode}
          onRoomJoined={() => {
            setInitialRoomCode("");
          }}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <RoomProvider>
            <MainApp />
          </RoomProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
