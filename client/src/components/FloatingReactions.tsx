import React, { useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";

interface FloatingEmojiItem {
  id: string;
  emoji: string;
  leftPercent: number;
}

export const FloatingReactions: React.FC = () => {
  const { socket } = useSocket();
  const [emojis, setEmojis] = useState<FloatingEmojiItem[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleReaction = (data: { emoji: string; username: string }) => {
      const newItem: FloatingEmojiItem = {
        id: Math.random().toString(36).substring(2, 9),
        emoji: data.emoji,
        leftPercent: 15 + Math.random() * 70, // random position between 15% and 85%
      };

      setEmojis((prev) => [...prev, newItem]);

      // Remove after 2 seconds (matches CSS animation)
      setTimeout(() => {
        setEmojis((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 2000);
    };

    socket.on("reaction", handleReaction);

    return () => {
      socket.off("reaction", handleReaction);
    };
  }, [socket]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {emojis.map((item) => (
        <span
          key={item.id}
          className="floating-emoji"
          style={{
            left: `${item.leftPercent}%`,
            bottom: "20px",
          }}
        >
          {item.emoji}
        </span>
      ))}
    </div>
  );
};
