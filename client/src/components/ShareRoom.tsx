import React, { useState } from "react";

interface ShareRoomProps {
  roomId: string;
}

export const ShareRoom: React.FC<ShareRoomProps> = ({ roomId }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const roomLink = `${window.location.origin}/room/${roomId}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Fallback
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "var(--bg-glass)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "0.5rem 0.85rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "none", fontWeight: 500 }}>
          Room
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 700,
            fontSize: "0.95rem",
            color: "var(--accent-primary)",
            letterSpacing: "0.06em",
          }}
        >
          {roomId}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button
          onClick={copyCode}
          className="btn-secondary"
          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
          title="Copy room code"
        >
          {copiedCode ? "✓ Copied" : "Copy code"}
        </button>
        <button
          onClick={copyLink}
          className="btn-secondary"
          style={{ padding: "0.3rem 0.65rem", fontSize: "0.75rem" }}
          title="Copy invite link"
        >
          {copiedLink ? "✓ Link copied" : "Share link"}
        </button>
      </div>
    </div>
  );
};
