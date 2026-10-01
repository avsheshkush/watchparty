import React from "react";
import { useRoom } from "../context/RoomContext";
import type { PendingRequest } from "../types";

export const RequestQueue: React.FC = () => {
  const { pendingRequests, you, resolveActionRequest, addToast } = useRoom();

  const isPrivileged = you?.role === "host" || you?.role === "moderator";

  if (!isPrivileged || pendingRequests.length === 0) {
    return null;
  }

  const handleResolve = async (req: PendingRequest, approve: boolean) => {
    try {
      await resolveActionRequest(req.requestId, approve);
      addToast(
        approve ? "success" : "info",
        `${approve ? "Approved" : "Rejected"} request from ${req.username}`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resolve request";
      addToast("error", msg);
    }
  };

  const getActionDescription = (req: PendingRequest) => {
    switch (req.type) {
      case "play":
        return `Start playback`;
      case "pause":
        return `Pause playback`;
      case "seek":
        return `Seek to ${req.payload.time !== undefined ? `${req.payload.time}s` : "position"}`;
      case "change_video":
        return `Change video (${req.payload.url || req.payload.videoId || ""})`;
      default:
        return req.type;
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: "1rem 1.25rem",
        marginBottom: "1rem",
        border: "1px solid rgba(245, 158, 11, 0.4)",
        background: "rgba(245, 158, 11, 0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fbbf24", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span>🔔 Pending participant requests</span>
          <span
            style={{
              background: "#fbbf24",
              color: "#080b12",
              fontSize: "0.75rem",
              fontWeight: 800,
              padding: "0.1rem 0.45rem",
              borderRadius: "var(--radius-full)",
            }}
          >
            {pendingRequests.length}
          </span>
        </h4>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {pendingRequests.map((req) => (
          <div
            key={req.requestId}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.5rem 0.75rem",
              background: "rgba(0,0,0,0.3)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.825rem", flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{req.username}</span>:{" "}
              <span style={{ color: "var(--text-muted)", wordBreak: "break-all" }}>{getActionDescription(req)}</span>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
              <button
                onClick={() => handleResolve(req, true)}
                className="btn-primary"
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  background: "rgba(16, 185, 129, 0.2)",
                  color: "#34d399",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  boxShadow: "none",
                }}
              >
                ✓ Approve
              </button>
              <button
                onClick={() => handleResolve(req, false)}
                className="btn-secondary"
                style={{
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                  color: "#fb7185",
                  borderColor: "rgba(244, 63, 94, 0.4)",
                }}
              >
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
