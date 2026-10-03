import React, { useState } from "react";
import { useRoom } from "../context/RoomContext";
import { useSocket } from "../context/SocketContext";
import { ShareRoom } from "./ShareRoom";
import { ParticipantList } from "./ParticipantList";
import { VideoPlayer } from "./VideoPlayer";
import { RequestQueue } from "./RequestQueue";
import { RequestModal } from "./RequestModal";
import { ReactionPicker } from "./ReactionPicker";
import { ChatPanel } from "./ChatPanel";
import { UserNav } from "./UserNav";

interface RoomPageProps {
  onRequestVideoChange?: (url: string) => void;
  onRequestAction?: (type: "play" | "pause" | "seek", payload?: { time?: number }) => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ onRequestVideoChange, onRequestAction }) => {
  const { roomId, you, participants, leaveRoom } = useRoom();
  const { isConnected } = useSocket();
  const [activeSidebarTab, setActiveSidebarTab] = useState<"participants" | "chat">("chat");

  if (!roomId) return null;

  const isPrivileged = you?.role === "host" || you?.role === "moderator";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <header className="room-header">
        <div className="room-header-inner">
          {/* Logo & Status */}
          <div className="header-brand-group">
            <div className="brand-logo" style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <span style={{ fontSize: "1.35rem" }}>🎬</span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1.2rem",
                  fontFamily: "var(--font-display)",
                  color: "#f8fafc",
                  letterSpacing: "-0.02em",
                }}
              >
                Watch<span style={{ color: "var(--accent-primary)" }}>Party</span>
              </span>
            </div>

            <span className={`status-pill ${isConnected ? "status-online" : "status-offline"}`}>
              <span className="status-dot" />
              {isConnected ? "Live sync" : "Reconnecting..."}
            </span>
          </div>

          {/* Share room controls, User profile & Leave */}
          <div className="header-actions-group">
            <ShareRoom roomId={roomId} />
            <UserNav />

            <button
              onClick={leaveRoom}
              className="btn-secondary leave-room-btn"
              title="Leave room"
            >
              <span className="mobile-action-text">Leave</span>
              <span className="desktop-action-text">Leave room</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid: Video Area + Sidebar (Stacked vertically on mobile, side-by-side on desktop) */}
      <main className="room-main-grid">
        {/* Video Area, Requests, Reactions & Custom Controls */}
        <section className="room-video-section">
          {/* Request Queue for Host/Moderator */}
          {isPrivileged && <RequestQueue />}

          <VideoPlayer
            onRequestVideoChange={onRequestVideoChange}
            onRequestAction={onRequestAction}
          />

          {/* User Status Bar, Quick Reactions & Request Trigger */}
          <div className="glass-panel user-status-panel">
            <div className="user-status-top-row">
              <div className="user-identity-box">
                <span className="user-identity-label">Signed in as</span>
                <span className="user-identity-name">{you?.username || "Guest"}</span>
              </div>

              <div className="user-role-actions-box">
                {!isPrivileged && <RequestModal />}

                <div className="user-role-box">
                  <span className="user-role-label">Room role</span>
                  <span
                    className="user-role-badge"
                    style={{
                      color:
                        you?.role === "host"
                          ? "#fbbf24"
                          : you?.role === "moderator"
                          ? "#93c5fd"
                          : "var(--text-muted)",
                    }}
                  >
                    {you?.role === "host" ? "👑 Host" : you?.role === "moderator" ? "🛡️ Moderator" : "Viewer"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Reactions Bar */}
            <div className="user-status-reactions-row">
              <ReactionPicker />
            </div>
          </div>
        </section>

        {/* Sidebar (Tabs for Participants vs Chat - Below video on mobile, right column on desktop) */}
        <aside className="room-sidebar">
          {/* Sidebar Tab Switcher */}
          <div className="glass-panel sidebar-tab-switcher">
            <button
              type="button"
              className={`chat-tab-btn ${activeSidebarTab === "chat" ? "active" : ""}`}
              onClick={() => setActiveSidebarTab("chat")}
            >
              <span>💬 Chat</span>
            </button>
            <button
              type="button"
              className={`chat-tab-btn ${activeSidebarTab === "participants" ? "active" : ""}`}
              onClick={() => setActiveSidebarTab("participants")}
            >
              <span>👥 People ({participants.length})</span>
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="sidebar-tab-content">
            {activeSidebarTab === "chat" ? <ChatPanel /> : <ParticipantList />}
          </div>
        </aside>
      </main>
    </div>
  );
};
