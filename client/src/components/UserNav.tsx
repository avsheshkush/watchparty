import React from "react";
import { useAuth } from "../context/AuthContext";

export const UserNav: React.FC = () => {
  const { user, signOut, isConfigured } = useAuth();

  if (!user) {
    return null;
  }

  const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        background: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(8px)",
        padding: "0.35rem 0.65rem 0.35rem 0.45rem",
        borderRadius: "9999px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Avatar Circle */}
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1, #f59e0b)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.8rem",
          fontWeight: 700,
          boxShadow: "0 0 10px rgba(99, 102, 241, 0.5)",
        }}
      >
        {initial}
      </div>

      {/* User Info */}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontSize: "0.825rem", fontWeight: 600, color: "#f8fafc" }}>
          {user.displayName}
        </span>
        <span style={{ fontSize: "0.68rem", color: "#94a3b8" }}>
          {isConfigured ? "Verified Member" : "Dev Profile"}
        </span>
      </div>

      {/* Sign Out Button */}
      <button
        type="button"
        onClick={() => signOut()}
        title="Sign Out"
        style={{
          marginLeft: "0.35rem",
          background: "rgba(255, 255, 255, 0.08)",
          border: "none",
          borderRadius: "6px",
          color: "#cbd5e1",
          cursor: "pointer",
          padding: "0.25rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: 500,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
          e.currentTarget.style.color = "#f87171";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
          e.currentTarget.style.color = "#cbd5e1";
        }}
      >
        Sign Out
      </button>
    </div>
  );
};
