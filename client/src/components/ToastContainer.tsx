import React from "react";
import { useRoom } from "../context/RoomContext";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useRoom();

  if (toasts.length === 0) return null;

  const getBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "#10b981";
      case "error":
        return "#f43f5e";
      case "warning":
        return "#f59e0b";
      default:
        return "#38bdf8";
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      default:
        return "ℹ";
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "360px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            background: "rgba(16, 21, 34, 0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${getBorderColor(toast.type)}`,
            borderRadius: "var(--radius-md)",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
            fontSize: "0.875rem",
            color: "var(--text-main)",
            animation: "slideIn 0.2s ease-out",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              background: getBorderColor(toast.type),
              color: "#000",
              fontWeight: 800,
              fontSize: "0.75rem",
              flexShrink: 0,
            }}
          >
            {getIcon(toast.type)}
          </span>
          <span style={{ flex: 1, wordBreak: "break-word" }}>{toast.text}</span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
              padding: "0.2rem",
            }}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
