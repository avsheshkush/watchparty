import React from "react";
import { useRoom } from "../context/RoomContext";
import { useSocket } from "../context/SocketContext";
import { ShareRoom } from "./ShareRoom";
import { ParticipantList } from "./ParticipantList";
import { VideoPlayer } from "./VideoPlayer";
import { RequestQueue } from "./RequestQueue";
import { RequestModal } from "./RequestModal";

interface RoomPageProps {
  onRequestVideoChange?: (url: string) => void;
  onRequestAction?: (type: "play" | "pause" | "seek", payload?: { time?: number }) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onRequestVideoChange, onRequestAction }) => {
  const { roomId, you, leaveRoom } = useRoom();
  const { isConnected } = useSocket();

  if (!roomId) return null;

  const isPrivileged = you?.role === "host" || you?.role === "moderator";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(10, 13, 20, 0.8)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
          padding: "0.75rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          {/* Logo & Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🎬</span>
              <span style={{ fontWeight: 800, fontSize: "1.25rem", background: "var(--accent-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                WatchParty
              </span>
            </div>

            <span className={`status-pill ${isConnected ? "status-online" : "status-offline"}`}>
              <span className="status-dot" />
              {isConnected ? "Live" : "Reconnecting..."}
            </span>
          </div>

          {/* Share room controls & Leave */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <ShareRoom roomId={roomId} />

            <button
              onClick={leaveRoom}
              className="btn-secondary"
              style={{ padding: "0.45rem 1rem", fontSize: "0.85rem", borderColor: "rgba(244, 63, 94, 0.4)", color: "#fb7185" }}
            >
              🚪 Leave
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: Video Area + Sidebar */}
      <main
        style={{
          flex: 1,
          maxWidth: "1400px",
          width: "100%",
          margin: "1.5rem auto",
          padding: "0 1.5rem",
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Video Area, Requests, & Custom Controls */}
        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Request Queue for Host/Moderator */}
          {isPrivileged && <RequestQueue />}

          <VideoPlayer
            onRequestVideoChange={onRequestVideoChange}
            onRequestAction={onRequestAction}
          />

          {/* User Status Bar & Request Trigger for Participants */}
          <div
            className="glass-panel"
            style={{
              padding: "1rem 1.25rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Signed in as</div>
              <div style={{ fontWeight: 700, fontSize: "1rem" }}>{you?.username || "Guest"}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              {!isPrivileged && <RequestModal />}

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Your Role</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: you?.role === "host" ? "#fbbf24" : you?.role === "moderator" ? "#c084fc" : "#94a3b8" }}>
                  {you?.role === "host" ? "👑 Room Host" : you?.role === "moderator" ? "🛡️ Moderator" : "Viewer"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Participant List */}
        <aside style={{ height: "calc(100vh - 120px)", position: "sticky", top: "80px" }}>
          <ParticipantList />
        </aside>
      </main>
    </div>
  );
};
