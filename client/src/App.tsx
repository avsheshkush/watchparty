import React, { useState, useEffect } from "react";
import { SocketProvider } from "./context/SocketContext";
import { RoomProvider, useRoom } from "./context/RoomContext";
import { LandingPage } from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";
import { ToastContainer } from "./components/ToastContainer";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Helper to extract room code from URL: /room/:roomId
function getRoomCodeFromPath(): string {
  const match = window.location.pathname.match(/\/room\/([A-Za-z0-9_-]+)/i);
  return match ? match[1].toUpperCase() : "";
}

const MainApp: React.FC = () => {
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

      {isAutoJoining ? (
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
              borderTopColor: "var(--accent-primary)",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#f8fafc", marginBottom: "0.25rem" }}>
              Reconnecting to Watch Party...
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
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
      <SocketProvider>
        <RoomProvider>
          <MainApp />
        </RoomProvider>
      </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;
