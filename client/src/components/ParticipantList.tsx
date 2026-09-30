import React, { useState } from "react";
import { useRoom } from "../context/RoomContext";
import type { Role, Participant } from "../types";

export const ParticipantList: React.FC = () => {
  const { participants, you, assignParticipantRole, removeParticipant, transferHost, addToast } = useRoom();
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  const isHost = you?.role === "host";

  const handlePromoteDemote = async (p: Participant) => {
    try {
      const newRole = p.role === "moderator" ? "participant" : "moderator";
      await assignParticipantRole(p.userId, newRole);
      addToast("success", `Updated ${p.username}'s role to ${newRole}`);
      setActiveMenuUserId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change role";
      addToast("error", msg);
    }
  };

  const handleTransfer = async (p: Participant) => {
    const ok = window.confirm(`Are you sure you want to transfer Host ownership to ${p.username}? You will become a Moderator.`);
    if (!ok) return;

    try {
      await transferHost(p.userId);
      addToast("success", `Host ownership transferred to ${p.username}`);
      setActiveMenuUserId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to transfer host";
      addToast("error", msg);
    }
  };

  const handleRemove = async (p: Participant) => {
    const ok = window.confirm(`Are you sure you want to kick ${p.username} out of the party?`);
    if (!ok) return;

    try {
      await removeParticipant(p.userId);
      addToast("info", `Removed ${p.username} from party`);
      setActiveMenuUserId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove participant";
      addToast("error", msg);
    }
  };

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

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", overflowY: "auto", flex: 1 }}>
        {participants.map((p) => {
          const isYou = you?.userId === p.userId;
          const canManageThisUser = isHost && !isYou && p.role !== "host";
          const isMenuOpen = activeMenuUserId === p.userId;

          return (
            <div
              key={p.userId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.7rem 0.85rem",
                borderRadius: "var(--radius-md)",
                background: isYou ? "rgba(99, 102, 241, 0.1)" : "var(--bg-glass)",
                border: isYou ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid var(--border-subtle)",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
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

                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {getRoleBadge(p.role)}

                  {canManageThisUser && (
                    <button
                      onClick={() => setActiveMenuUserId(isMenuOpen ? null : p.userId)}
                      className="btn-secondary"
                      style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      title="Manage participant"
                    >
                      ⚙️
                    </button>
                  )}
                </div>
              </div>

              {/* Host Action Drawer for this participant */}
              {isMenuOpen && canManageThisUser && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.35rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <button
                    onClick={() => handlePromoteDemote(p)}
                    className="btn-secondary"
                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.72rem" }}
                  >
                    {p.role === "moderator" ? "Demote to Viewer" : "Promote to Mod"}
                  </button>

                  <button
                    onClick={() => handleTransfer(p)}
                    className="btn-secondary"
                    style={{ padding: "0.3rem 0.5rem", fontSize: "0.72rem", color: "#fbbf24" }}
                  >
                    Make Host 👑
                  </button>

                  <button
                    onClick={() => handleRemove(p)}
                    className="btn-secondary"
                    style={{
                      gridColumn: "1 / -1",
                      padding: "0.3rem 0.5rem",
                      fontSize: "0.72rem",
                      color: "#fb7185",
                      borderColor: "rgba(244, 63, 94, 0.3)",
                    }}
                  >
                    Kick from Party 🚪
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
