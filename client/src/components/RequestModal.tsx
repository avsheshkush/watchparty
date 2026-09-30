import React, { useState } from "react";
import { useRoom } from "../context/RoomContext";

export const RequestModal: React.FC = () => {
  const { you, submitActionRequest, addToast } = useRoom();
  const [isOpen, setIsOpen] = useState(false);
  const [requestType, setRequestType] = useState<"play" | "pause" | "seek" | "change_video">("play");
  const [seekTime, setSeekTime] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Privileged users (Host, Mod) don't need to request
  if (you?.role === "host" || you?.role === "moderator") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: { time?: number; url?: string } = {};
      if (requestType === "seek") {
        payload.time = Number(seekTime);
      } else if (requestType === "change_video") {
        payload.url = videoUrl.trim();
      }

      await submitActionRequest(requestType, payload);
      setIsOpen(false);
      setVideoUrl("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      addToast("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary"
        style={{
          padding: "0.45rem 1rem",
          fontSize: "0.85rem",
          borderColor: "rgba(245, 158, 11, 0.4)",
          color: "#fbbf24",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>📩</span>
        <span>Propose Action to Host</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: "440px",
              width: "100%",
              padding: "1.75rem",
              background: "rgba(16, 21, 34, 0.98)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Propose Playback Change</h3>
              <button
                onClick={() => setIsOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "1.2rem" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                  Action to Propose
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "0.6rem 0.8rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    color: "#fff",
                    fontSize: "0.9rem",
                    outline: "none",
                  }}
                >
                  <option value="play" style={{ background: "#101522" }}>▶ Play Video</option>
                  <option value="pause" style={{ background: "#101522" }}>⏸ Pause Video</option>
                  <option value="seek" style={{ background: "#101522" }}>⏩ Seek to Timestamp</option>
                  <option value="change_video" style={{ background: "#101522" }}>🎬 Change Video</option>
                </select>
              </div>

              {requestType === "seek" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                    Seek Time (seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={seekTime}
                    onChange={(e) => setSeekTime(Number(e.target.value))}
                    required
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.8rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      color: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              {requestType === "change_video" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                    YouTube Video URL or ID
                  </label>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtu.be/..."
                    required
                    style={{
                      width: "100%",
                      padding: "0.6rem 0.8rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      color: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary"
                  style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{ padding: "0.5rem 1.25rem", fontSize: "0.85rem" }}
                >
                  {isSubmitting ? "Submitting..." : "Send Request 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
