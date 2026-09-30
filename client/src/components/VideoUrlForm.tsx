import React, { useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoom } from "../context/RoomContext";

interface VideoUrlFormProps {
  canControl: boolean;
  onRequestVideoChange?: (url: string) => void;
}

export const VideoUrlForm: React.FC<VideoUrlFormProps> = ({ canControl, onRequestVideoChange }) => {
  const { emitWithAck } = useSocket();
  const { addToast } = useRoom();

  const [inputUrl, setInputUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputUrl.trim();
    if (!trimmed) return;

    if (!canControl) {
      // If participant, trigger request approval flow
      onRequestVideoChange?.(trimmed);
      setInputUrl("");
      return;
    }

    setIsSubmitting(true);
    try {
      await emitWithAck("change_video", { url: trimmed });
      addToast("success", "Video changed successfully");
      setInputUrl("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to change video";
      addToast("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
      }}
    >
      <input
        type="text"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        placeholder={canControl ? "Paste YouTube URL or Video ID (e.g. youtu.be/...)" : "Participants must request video changes"}
        disabled={isSubmitting}
        style={{
          flex: 1,
          padding: "0.6rem 0.9rem",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          color: "#fff",
          fontSize: "0.875rem",
          outline: "none",
        }}
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={isSubmitting || !inputUrl.trim()}
        style={{ padding: "0.6rem 1.1rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
      >
        {isSubmitting
          ? "Changing..."
          : canControl
          ? "🎬 Change Video"
          : "📩 Propose Video"}
      </button>
    </form>
  );
};
