import React, { useEffect, useRef } from "react";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { useRoom } from "../context/RoomContext";
import { useSocket } from "../context/SocketContext";
import { PlaybackControls } from "./PlaybackControls";
import { VideoUrlForm } from "./VideoUrlForm";
import { FloatingReactions } from "./FloatingReactions";

interface VideoPlayerProps {
  onRequestVideoChange?: (url: string) => void;
  onRequestAction?: (type: "play" | "pause" | "seek", payload?: { time?: number }) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ onRequestVideoChange, onRequestAction }) => {
  const { videoState, you, addToast } = useRoom();
  const { emitWithAck } = useSocket();
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const canControl = you?.role === "host" || you?.role === "moderator";

  const {
    isReady,
    currentTime,
    duration,
    isMuted,
    volume,
    hasStartedGesture,
    startPlaybackGesture,
    applyRemoteState,
    toggleMute,
    changeVolume,
  } = useYouTubePlayer({
    containerId: "yt-player-container",
    initialVideoId: videoState?.videoId || "jNQXAC9IVRw",
    onError: (code) => {
      if (code === 101 || code === 150) {
        addToast("error", "The video owner has disabled embedding for this video.");
      } else if (code === 2) {
        addToast("error", "Invalid YouTube video ID.");
      } else {
        addToast("warning", "Video player encountered a playback issue.");
      }
    },
  });

  // Apply server authoritative state updates when received
  useEffect(() => {
    if (videoState && isReady) {
      applyRemoteState(videoState);
    }
  }, [videoState, isReady, applyRemoteState]);

  // Controls actions (Privileged)
  const handlePlay = async () => {
    if (!canControl) {
      onRequestAction?.("play");
      return;
    }
    try {
      await emitWithAck("play", { time: currentTime });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to play";
      addToast("error", msg);
    }
  };

  const handlePause = async () => {
    if (!canControl) {
      onRequestAction?.("pause");
      return;
    }
    try {
      await emitWithAck("pause", {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to pause";
      addToast("error", msg);
    }
  };

  const handleSeek = async (time: number) => {
    if (!canControl) {
      onRequestAction?.("seek", { time });
      return;
    }
    try {
      await emitWithAck("seek", { time });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to seek";
      addToast("error", msg);
    }
  };

  const handleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const isPlaying = videoState ? videoState.playState === "playing" : false;

  return (
    <div
      ref={playerContainerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        width: "100%",
      }}
    >
      {/* 16:9 Video Canvas */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        {/* YouTube IFrame Mount Target */}
        <div
          id="yt-player-container"
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: "none", // Prevent native hover tooltips
          }}
        />

        {/* Floating Reactions Overlay */}
        <FloatingReactions />

        {/* Transparent Overlay (SPEC §7): Blocks all native player mouse clicks */}
        <div
          id="transparent-iframe-overlay"
          onClick={() => {
            if (!hasStartedGesture) {
              startPlaybackGesture();
            } else if (canControl) {
              isPlaying ? handlePause() : handlePlay();
            }
          }}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            background: "transparent",
            cursor: canControl ? "pointer" : "default",
          }}
        />

        {/* Autoplay / Click-to-Start Gate (SPEC §7) */}
        {!hasStartedGesture && (
          <div
            onClick={startPlaybackGesture}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 20,
              background: "rgba(10, 13, 20, 0.85)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: "1.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "var(--accent-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "2rem",
                color: "#080b12",
                boxShadow: "0 0 35px rgba(245, 158, 11, 0.45)",
                marginBottom: "1rem",
                paddingLeft: "4px", // optical alignment for play icon
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              ▶
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "#f8fafc", marginBottom: "0.4rem" }}>
              Click to Join Audio & Stream
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: "340px", lineHeight: "1.4" }}>
              Browser audio autoplay requires user interaction before unmuting.
            </p>
          </div>
        )}
      </div>

      {/* Custom Control Bar */}
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        isMuted={isMuted}
        volume={volume}
        canControl={canControl}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onToggleMute={toggleMute}
        onChangeVolume={changeVolume}
        onFullscreen={handleFullscreen}
      />

      {/* Video URL Input Form */}
      <div className="glass-panel" style={{ padding: "0.75rem 1rem" }}>
        <VideoUrlForm canControl={canControl} onRequestVideoChange={onRequestVideoChange} />
      </div>
    </div>
  );
};
