import React, { useState, useEffect } from "react";
import { useRoom } from "../context/RoomContext";
import { useSocket } from "../context/SocketContext";
import { getSavedUsername } from "../utils/storage";

interface LandingPageProps {
  initialRoomCode?: string;
  onRoomJoined: (roomId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ initialRoomCode = "", onRoomJoined }) => {
  const { createRoom, joinRoom, kickedReason, clearKickedReason } = useRoom();
  const { isConnected } = useSocket();

  const [mode, setMode] = useState<"create" | "join">(initialRoomCode ? "join" : "create");
  const [username, setUsername] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const saved = getSavedUsername();
    if (saved) setUsername(saved);
  }, []);

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
      <div className="glass-panel" style={{ padding: "2.25rem 2rem" }}>
        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🍿</div>
          <h2
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              background: "var(--accent-gradient)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            YouTube WatchParty
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Watch videos together in perfect sync
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.35rem",
            background: "rgba(0, 0, 0, 0.3)",
            padding: "0.35rem",
            borderRadius: "var(--radius-md)",
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
              background: mode === "create" ? "var(--accent-gradient)" : "transparent",
              color: mode === "create" ? "#fff" : "var(--text-muted)",
              border: "none",
              padding: "0.6rem 0",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Create Room
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("join");
              setError("");
            }}
            style={{
              background: mode === "join" ? "var(--accent-gradient)" : "transparent",
              color: mode === "join" ? "#fff" : "var(--text-muted)",
              border: "none",
              padding: "0.6rem 0",
              borderRadius: "var(--radius-sm)",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            Join Room
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label
              htmlFor="username-input"
              style={{
                display: "block",
                color: "var(--text-muted)",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: "0.4rem",
              }}
            >
              Your Name
            </label>
            <input
              id="username-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={20}
              required
              style={{
                width: "100%",
                padding: "0.75rem 1rem",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                color: "#fff",
                fontSize: "1rem",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
            />
          </div>

          {mode === "join" && (
            <div>
              <label
                htmlFor="room-code-input"
                style={{
                  display: "block",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "0.4rem",
                }}
              >
                6-Character Room Code
              </label>
              <input
                id="room-code-input"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC234"
                maxLength={10}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  color: "#fff",
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.1rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  outline: "none",
                  transition: "border-color 0.2s ease",
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
                padding: "0.5rem 0.75rem",
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
              ? "🚀 Create Room & Become Host"
              : "🎟️ Join Watch Party"}
          </button>
        </form>
      </div>
    </div>
  );
};
