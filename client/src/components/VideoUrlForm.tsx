import React, { useState } from "react";
import { useSocket } from "../context/SocketContext";
import { useRoom } from "../context/RoomContext";

interface VideoUrlFormProps {
  canControl: boolean;
  onRequestVideoChange?: (url: string) => void;
}

export const VideoUrlForm: React.FC<VideoUrlFormProps> = React.memo(({ canControl, onRequestVideoChange }) => {
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
        placeholder={canControl ? "Paste YouTube URL or Video ID (e.g. youtu.be/...)" : "Participants can propose video changes"}
        disabled={isSubmitting}
        className="input-field"
        style={{
          flex: 1,
          padding: "0.6rem 0.9rem",
          fontSize: "0.875rem",
        }}
      />
      <button
        type="submit"
        className="btn-primary"
        disabled={isSubmitting || !inputUrl.trim()}
        style={{ padding: "0.6rem 1.25rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
      >
        {isSubmitting
          ? "Changing..."
          : canControl
          ? "Load video"
          : "Propose video"}
      </button>
    </form>
  );
});
