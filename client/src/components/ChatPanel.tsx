import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoom } from "../context/RoomContext";

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  role: string;
  text: string;
  timestamp: number;
}

export const ChatPanel: React.FC = React.memo(() => {
  const { socket, isConnected } = useSocket();
  const { you, addToast } = useRoom();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("chat_message", handleChatMessage);

    return () => {
      socket.off("chat_message", handleChatMessage);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !socket || isSending) return;

    if (text.length > 300) {
      addToast("warning", "Message exceeds 300 characters limit.");
      return;
    }

    setIsSending(true);

    socket.emit("chat_message", { text }, (res: any) => {
      setIsSending(false);
      if (res && !res.ok) {
        if (res.code === "RATE_LIMITED") {
          addToast("error", "You are sending messages too quickly. Slow down!");
        } else {
          addToast("error", res.message || "Failed to send message");
        }
      } else {
        setInputText("");
      }
    });
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className="glass-panel chat-panel-container"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 170px)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.85rem 1rem",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>💬</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Room Chat</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          {messages.length} {messages.length === 1 ? "message" : "messages"}
        </span>
      </div>

      {/* Messages list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-dim)",
              fontSize: "0.85rem",
              textAlign: "center",
              gap: "0.5rem",
              padding: "2rem 1rem",
            }}
          >
            <span style={{ fontSize: "2rem" }}>👋</span>
            <p>No messages yet.</p>
            <p style={{ fontSize: "0.75rem" }}>Say hi to start the party discussion!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.userId === you?.userId;
            return (
              <div
                key={m.id}
                className="chat-message-bubble"
                style={{
                  borderLeft: isMe ? "3px solid var(--accent-primary)" : undefined,
                  background: isMe ? "rgba(245, 158, 11, 0.07)" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.3rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        color: isMe ? "#fbbf24" : "var(--text-main)",
                      }}
                    >
                      {m.username}
                    </span>
                    {m.role === "host" && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "var(--radius-full)",
                          background: "rgba(245, 158, 11, 0.15)",
                          color: "#fbbf24",
                          border: "1px solid rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        Host
                      </span>
                    )}
                    {m.role === "moderator" && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "var(--radius-full)",
                          background: "rgba(96, 165, 250, 0.15)",
                          color: "#93c5fd",
                          border: "1px solid rgba(96, 165, 250, 0.3)",
                        }}
                      >
                        Mod
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                    {formatTime(m.timestamp)}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", lineHeight: "1.45", color: "var(--text-main)" }}>
                  {m.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border-subtle)",
          background: "rgba(10, 13, 20, 0.6)",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            className="input-field"
            placeholder={isConnected ? "Type a message... (max 300)" : "Connecting to chat..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!isConnected || isSending}
            maxLength={300}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              fontSize: "0.85rem",
            }}
          />
          <button
            type="submit"
            disabled={!inputText.trim() || !isConnected || isSending}
            className="btn-primary"
            style={{
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
            }}
          >
            Send
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.7rem",
            color: inputText.length > 270 ? "#fb7185" : "var(--text-dim)",
          }}
        >
          <span>Press Enter to send</span>
          <span>{inputText.length} / 300</span>
        </div>
      </form>
    </div>
  );
});
