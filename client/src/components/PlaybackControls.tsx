import React from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  volume: number;
  canControl: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onChangeVolume: (val: number) => void;
  onFullscreen?: () => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${formattedMins}:${formattedSecs}`;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  isMuted,
  volume,
  canControl,
  onPlay,
  onPause,
  onSeek,
  onToggleMute,
  onChangeVolume,
  onFullscreen,
}) => {
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControl) return;
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        background: "rgba(10, 13, 20, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "0.75rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      {/* Scrubber slider */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: "42px" }}>
          {formatTime(currentTime)}
        </span>

        <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeekChange}
            disabled={!canControl}
            title={!canControl ? "Only Host/Moderators can control playback" : "Seek video"}
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "4px",
              accentColor: canControl ? "var(--accent-primary)" : "#64748b",
              cursor: canControl ? "pointer" : "not-allowed",
              background: `linear-gradient(to right, ${canControl ? "#6366f1" : "#475569"} ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%)`,
            }}
          />
        </div>

        <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: "42px" }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Buttons Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Play/Pause + Fast Seeks */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canControl}
            title={!canControl ? "Only Host/Moderators can control playback" : isPlaying ? "Pause" : "Play"}
            style={{
              background: canControl ? "var(--accent-gradient)" : "rgba(255,255,255,0.05)",
              color: canControl ? "#fff" : "var(--text-dim)",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "0.45rem 1rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: canControl ? "pointer" : "not-allowed",
              opacity: canControl ? 1 : 0.6,
              transition: "all 0.2s ease",
            }}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>

          {/* Quick jump -10s / +10s */}
          {canControl && (
            <>
              <button
                onClick={() => onSeek(Math.max(0, currentTime - 10))}
                className="btn-secondary"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                title="Rewind 10s"
              >
                ⏪ -10s
              </button>
              <button
                onClick={() => onSeek(Math.min(duration, currentTime + 10))}
                className="btn-secondary"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                title="Forward 10s"
              >
                ⏩ +10s
              </button>
            </>
          )}

          {!canControl && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--text-dim)",
                background: "rgba(255,255,255,0.04)",
                padding: "0.25rem 0.6rem",
                borderRadius: "var(--radius-sm)",
              }}
            >
              🔒 Playback controlled by Host & Mod
            </span>
          )}
        </div>

        {/* Volume & Audio Controls (Client local, always allowed) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={onToggleMute}
            style={{
              background: "transparent",
              border: "none",
              color: isMuted ? "#f43f5e" : "var(--text-main)",
              cursor: "pointer",
              fontSize: "1.1rem",
            }}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            style={{
              width: "70px",
              height: "4px",
              accentColor: "var(--accent-primary)",
              cursor: "pointer",
            }}
            title="Volume"
          />

          {onFullscreen && (
            <button
              onClick={onFullscreen}
              className="btn-secondary"
              style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
              title="Fullscreen"
            >
              ⛶
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
