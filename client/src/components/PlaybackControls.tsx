import React from "react";

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  volume: number;
  canControl: boolean;
  isFullscreen?: boolean;
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
  isFullscreen,
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
      className="playback-controls-panel"
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
      <div className="scrubber-row" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <span className="time-display time-current" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: "42px" }}>
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
            className="scrubber-slider"
            style={{
              width: "100%",
              height: "6px",
              borderRadius: "4px",
              accentColor: canControl ? "var(--accent-primary)" : "#64748b",
              cursor: canControl ? "pointer" : "not-allowed",
              background: `linear-gradient(to right, ${canControl ? "#f59e0b" : "#475569"} ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%)`,
            }}
          />
        </div>

        <span className="time-display time-duration" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", minWidth: "42px" }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Buttons Bar */}
      <div className="controls-button-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Play/Pause + Fast Seeks */}
        <div className="controls-left-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!canControl}
            title={!canControl ? "Only Host/Moderators can control playback" : isPlaying ? "Pause (Space)" : "Play (Space)"}
            className="control-btn play-pause-btn"
            style={{
              background: canControl ? "var(--accent-primary)" : "rgba(255,255,255,0.05)",
              color: canControl ? "#090c15" : "var(--text-dim)",
              border: canControl ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "0.45rem 1rem",
              fontWeight: 700,
              fontSize: "0.875rem",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              cursor: canControl ? "pointer" : "not-allowed",
              opacity: canControl ? 1 : 0.6,
              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>

          {/* Quick jump -10s / +10s */}
          {canControl && (
            <>
              <button
                onClick={() => onSeek(Math.max(0, currentTime - 10))}
                className="btn-secondary control-btn jump-btn"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                title="Rewind 10s (Left Arrow -5s)"
              >
                ⏪ -10s
              </button>
              <button
                onClick={() => onSeek(Math.min(duration, currentTime + 10))}
                className="btn-secondary control-btn jump-btn"
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.75rem" }}
                title="Forward 10s (Right Arrow +5s)"
              >
                ⏩ +10s
              </button>
            </>
          )}

          {!canControl && (
            <span
              className="role-lock-badge"
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
        <div className="controls-right-group" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={onToggleMute}
            className="control-btn mute-btn"
            style={{
              background: "transparent",
              border: "none",
              color: isMuted ? "#f43f5e" : "var(--text-main)",
              cursor: "pointer",
              fontSize: "1.1rem",
              padding: "0.3rem",
            }}
            title={isMuted ? "Unmute (m)" : "Mute (m)"}
          >
            {isMuted || volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => onChangeVolume(Number(e.target.value))}
            className="controls-volume-slider"
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
              className="btn-secondary control-btn fullscreen-btn"
              style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
              title={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"}
            >
              {isFullscreen ? "⤓" : "⛶"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
