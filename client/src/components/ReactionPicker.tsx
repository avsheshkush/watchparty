import React from "react";
import { useSocket } from "../context/SocketContext";

const EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "👏"] as const;

export const ReactionPicker: React.FC = () => {
  const { socket, isConnected } = useSocket();

  const handleSendReaction = (emoji: string) => {
    if (!socket || !isConnected) return;
    socket.emit("reaction", { emoji });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        background: "rgba(255, 255, 255, 0.04)",
        padding: "0.35rem 0.6rem",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 600, marginRight: "0.2rem" }}>
        React:
      </span>
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleSendReaction(emoji)}
          disabled={!isConnected}
          className="reaction-btn"
          title={`Send ${emoji} reaction`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
