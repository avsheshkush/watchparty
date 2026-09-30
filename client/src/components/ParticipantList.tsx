import React from "react";
import { useRoom } from "../context/RoomContext";
import type { Role } from "../types";

export const ParticipantList: React.FC = () => {
  const { participants, you } = useRoom();

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case "host":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "rgba(245, 158, 11, 0.15)",
              color: "#fbbf24",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            👑 Host
          </span>
        );
      case "moderator":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "rgba(139, 92, 246, 0.15)",
              color: "#c084fc",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            🛡️ Mod
          </span>
        );
      default:
        return (
          <span
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              color: "var(--text-dim)",
              border: "1px solid var(--border-subtle)",
              padding: "0.15rem 0.5rem",
              borderRadius: "var(--radius-full)",
              fontSize: "0.7rem",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            Viewer
          </span>
        );
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>👥 Party Members</span>
          <span
            style={{
              background: "var(--bg-glass)",
              color: "var(--text-muted)",
              fontSize: "0.75rem",
              padding: "0.1rem 0.5rem",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {participants.length}
          </span>
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", flex: 1 }}>
        {participants.map((p) => {
          const isYou = you?.userId === p.userId;
          return (
            <div
              key={p.userId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.85rem",
                borderRadius: "var(--radius-md)",
                background: isYou ? "rgba(99, 102, 241, 0.1)" : "var(--bg-glass)",
                border: isYou ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {/* Online indicator */}
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: p.connected ? "#10b981" : "#64748b",
                    boxShadow: p.connected ? "0 0 6px #10b981" : "none",
                  }}
                  title={p.connected ? "Online" : "Disconnected"}
                />

                <span style={{ fontWeight: isYou ? 700 : 500, fontSize: "0.875rem" }}>
                  {p.username}
                  {isYou && (
                    <span style={{ color: "var(--accent-primary)", fontSize: "0.75rem", marginLeft: "0.35rem" }}>
                      (You)
                    </span>
                  )}
                </span>
              </div>

              <div>{getRoleBadge(p.role)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
