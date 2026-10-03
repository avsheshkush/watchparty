import React, { useState, useEffect } from "react";
import { useRoom } from "../context/RoomContext";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import { getSavedUsername } from "../utils/storage";

interface LandingPageProps {
  initialRoomCode?: string;
  onRoomJoined: (roomId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ initialRoomCode = "", onRoomJoined }) => {
  const { createRoom, joinRoom, kickedReason, clearKickedReason } = useRoom();
  const { isConnected } = useSocket();
  const { user } = useAuth();

  const [mode, setMode] = useState<"create" | "join">(initialRoomCode ? "join" : "create");
  const [username, setUsername] = useState<string>(() => user?.displayName || getSavedUsername());
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user?.displayName) {
      setUsername(user.displayName);
    } else {
      const saved = getSavedUsername();
      if (saved) setUsername(saved);
    }
  }, [user]);

  useEffect(() => {
    if (initialRoomCode) {
      setMode("join");
      setRoomCode(initialRoomCode.toUpperCase().trim());
    }
  }, [initialRoomCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUser = username.trim();
    if (trimmedUser.length < 2 || trimmedUser.length > 20) {
      setError("Username must be between 2 and 20 characters");
      return;
    }

    if (!isConnected) {
      setError("Connecting to server, please wait a moment...");
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "create") {
        const newRoomId = await createRoom(trimmedUser);
        window.history.pushState({}, "", `/room/${newRoomId}`);
        onRoomJoined(newRoomId);
      } else {
        const cleanCode = roomCode.toUpperCase().trim();
        if (!cleanCode) {
          setError("Please enter a room code");
          setIsLoading(false);
          return;
        }
        await joinRoom(cleanCode, trimmedUser);
        window.history.pushState({}, "", `/room/${cleanCode}`);
        onRoomJoined(cleanCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join room";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "460px", margin: "4rem auto 2rem", width: "100%", padding: "0 1.25rem" }}>
      {/* Kicked Alert */}
      {kickedReason && (
        <div
          style={{
            background: "rgba(244, 63, 94, 0.15)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            color: "#fb7185",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>⚠️ {kickedReason}</span>
          <button
            onClick={clearKickedReason}
            style={{ background: "none", border: "none", color: "#fb7185", cursor: "pointer", fontSize: "1.1rem" }}
          >
            ×
          </button>
        </div>
      )}

      {/* Main Glass Card */}
      <div className="glass-panel" style={{ padding: "2.5rem 2rem" }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.75rem", marginBottom: "0.5rem" }}>🎬</div>
          <h1
            style={{
              fontSize: "1.85rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--text-main)",
            }}
          >
            Watch<span style={{ color: "var(--accent-primary)" }}>Party</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.35rem" }}>
            Synchronized YouTube cinema for you and your friends
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.35rem",
            background: "rgba(0, 0, 0, 0.4)",
            padding: "0.3rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "1.75rem",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setError("");
            }}
            style={{
              background: mode === "create" ? "var(--accent-primary)" : "transparent",
              color: mode === "create" ? "#090c15" : "var(--text-muted)",
              border: "none",
              padding: "0.6rem 0",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Create party
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("join");
              setError("");
            }}
            style={{
              background: mode === "join" ? "var(--accent-primary)" : "transparent",
              color: mode === "join" ? "#090c15" : "var(--text-muted)",
              border: "none",
              padding: "0.6rem 0",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Join with code
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              htmlFor="username-input"
              style={{
                display: "block",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.45rem",
              }}
            >
              Your display name
            </label>
            <input
              id="username-input"
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={20}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "#fff",
                fontSize: "0.95rem",
              }}
            />
          </div>

          {mode === "join" && (
            <div>
              <label
                htmlFor="room-code-input"
                style={{
                  display: "block",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  marginBottom: "0.45rem",
                }}
              >
                6-character room code
              </label>
              <input
                id="room-code-input"
                type="text"
                className="input-field"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC234"
                maxLength={10}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  color: "#fff",
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.1rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                color: "var(--status-danger)",
                fontSize: "0.85rem",
                background: "rgba(244, 63, 94, 0.1)",
                padding: "0.6rem 0.85rem",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(244, 63, 94, 0.25)",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || !isConnected}
            style={{ width: "100%", marginTop: "0.5rem", padding: "0.85rem" }}
          >
            {isLoading
              ? "Connecting..."
              : mode === "create"
              ? "Start Watch Party"
              : "Enter Watch Party"}
          </button>
        </form>

        {/* Feature Pills */}
        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "center",
            gap: "0.85rem",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ color: "var(--accent-primary)" }}>●</span> Real-time sync
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ color: "var(--accent-primary)" }}>●</span> Host controls
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ color: "var(--accent-primary)" }}>●</span> Live chat
          </span>
        </div>
      </div>
    </div>
  );
};
