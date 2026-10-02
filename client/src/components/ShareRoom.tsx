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
    <div className="share-room-container">
      <div className="room-code-display">
        <span className="room-code-label">Room</span>
        <span className="room-code-value">{roomId}</span>
      </div>

      <div className="room-code-buttons">
        <button
          onClick={copyCode}
          className="btn-secondary room-action-btn"
          title="Copy room code"
        >
          {copiedCode ? (
            "✓ Copied"
          ) : (
            <>
              <span className="mobile-action-text">Copy</span>
              <span className="desktop-action-text">Copy code</span>
            </>
          )}
        </button>
        <button
          onClick={copyLink}
          className="btn-secondary room-action-btn"
          title="Copy invite link"
        >
          {copiedLink ? (
            "✓ Copied"
          ) : (
            <>
              <span className="mobile-action-text">Share</span>
              <span className="desktop-action-text">Share link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
