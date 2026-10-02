import React, { useEffect, useRef, useState, useCallback } from "react";
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

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [feedback, setFeedback] = useState<{ icon: string; text?: string } | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canControl = you?.role === "host" || you?.role === "moderator";

  const {
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
    if (videoState) {
      applyRemoteState(videoState);
    }
  }, [videoState, applyRemoteState]);

  // Visual HUD feedback indicator for shortcuts
  const triggerFeedback = useCallback((icon: string, text?: string) => {
    setFeedback({ icon, text });
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 750);
  }, []);

  // Controls actions (Privileged or Participant Action Request)
  const handlePlay = useCallback(async () => {
    if (!hasStartedGesture) {
      startPlaybackGesture();
    }
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
  }, [hasStartedGesture, startPlaybackGesture, canControl, onRequestAction, emitWithAck, currentTime, addToast]);

  const handlePause = useCallback(async () => {
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
  }, [canControl, onRequestAction, emitWithAck, addToast]);

  const handleSeek = useCallback(async (time: number) => {
    if (!hasStartedGesture) {
      startPlaybackGesture();
    }
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
  }, [hasStartedGesture, startPlaybackGesture, canControl, onRequestAction, emitWithAck, addToast]);

  // Cross-browser fullscreen toggle
  const handleFullscreen = useCallback(() => {
    const el = playerContainerRef.current as any;
    if (!el) return;
    const doc = document as any;
    const isFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
    if (!isFull) {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  }, []);

  // Reset hide timer for fullscreen controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    const isCurrentFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    if (isCurrentFs) {
      controlsTimeoutRef.current = setTimeout(() => {
        // Do not auto-hide if user is actively focused in an input field (e.g. typing URL)
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
          return;
        }
        setShowControls(false);
      }, 2800);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // Fullscreen change listener across browsers
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFull);
      if (!isFull) {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
        setShowControls(true);
      } else {
        resetControlsTimeout();
      }
    };

    const events = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
    events.forEach((ev) => document.addEventListener(ev, handleFullscreenChange));

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, handleFullscreenChange));
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  const isPlaying = videoState ? videoState.playState === "playing" : false;

  // Sync latest values in refs to avoid stale closures in window keydown listener
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const handlePlayRef = useRef(handlePlay);
  handlePlayRef.current = handlePlay;

  const handlePauseRef = useRef(handlePause);
  handlePauseRef.current = handlePause;

  const handleSeekRef = useRef(handleSeek);
  handleSeekRef.current = handleSeek;

  const toggleMuteRef = useRef(toggleMute);
  toggleMuteRef.current = toggleMute;

  const changeVolumeRef = useRef(changeVolume);
  changeVolumeRef.current = changeVolume;

  const handleFullscreenRef = useRef(handleFullscreen);
  handleFullscreenRef.current = handleFullscreen;

  // Global keyboard shortcuts (Space: pause/play, ArrowLeft/Right: seek, F: fullscreen, M: mute, ArrowUp/Down: volume)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      // Do not capture keyboard shortcuts if the user is typing in chat, inputs, or textareas
      const isTextInput =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" &&
            !["range", "checkbox", "radio", "button", "submit", "reset"].includes(
              (target as HTMLInputElement).type
            )));

      if (isTextInput) {
        return;
      }

      // 1. Play / Pause toggle with Space or K
      if (e.code === "Space" || e.code === "KeyK") {
        e.preventDefault();
        if (target && (target.tagName === "BUTTON" || (target.tagName === "INPUT" && (target as HTMLInputElement).type === "range"))) {
          target.blur();
        }
        if (isPlayingRef.current) {
          triggerFeedback("⏸", "Pause");
          handlePauseRef.current();
        } else {
          triggerFeedback("▶", "Play");
          handlePlayRef.current();
        }
        resetControlsTimeout();
        return;
      }

      // 2. Seek backward with ArrowLeft or J (-5 seconds)
      if (e.code === "ArrowLeft" || e.code === "KeyJ") {
        e.preventDefault();
        if (target && target.tagName === "INPUT" && (target as HTMLInputElement).type === "range") {
          target.blur();
        }
        const cur = currentTimeRef.current;
        const newTime = Math.max(0, cur - 5);
        triggerFeedback("⏪", "-5s");
        handleSeekRef.current(newTime);
        resetControlsTimeout();
        return;
      }

      // 3. Seek forward with ArrowRight or L (+5 seconds)
      if (e.code === "ArrowRight" || e.code === "KeyL") {
        e.preventDefault();
        if (target && target.tagName === "INPUT" && (target as HTMLInputElement).type === "range") {
          target.blur();
        }
        const cur = currentTimeRef.current;
        const dur = durationRef.current;
        const maxTime = dur > 0 ? dur : cur + 60;
        const newTime = Math.min(maxTime, cur + 5);
        triggerFeedback("⏩", "+5s");
        handleSeekRef.current(newTime);
        resetControlsTimeout();
        return;
      }

      // 4. Fullscreen toggle with F
      if (e.code === "KeyF") {
        e.preventDefault();
        handleFullscreenRef.current();
        resetControlsTimeout();
        return;
      }

      // 5. Mute toggle with M
      if (e.code === "KeyM") {
        e.preventDefault();
        triggerFeedback(isMutedRef.current ? "🔊" : "🔇", isMutedRef.current ? "Unmuted" : "Muted");
        toggleMuteRef.current();
        resetControlsTimeout();
        return;
      }

      // 6. Volume Up with ArrowUp (+5%)
      if (e.code === "ArrowUp") {
        e.preventDefault();
        const newVol = Math.min(100, volumeRef.current + 5);
        triggerFeedback("🔊", `${newVol}%`);
        changeVolumeRef.current(newVol);
        resetControlsTimeout();
        return;
      }

      // 7. Volume Down with ArrowDown (-5%)
      if (e.code === "ArrowDown") {
        e.preventDefault();
        const newVol = Math.max(0, volumeRef.current - 5);
        triggerFeedback(newVol === 0 ? "🔇" : "🔉", `${newVol}%`);
        changeVolumeRef.current(newVol);
        resetControlsTimeout();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [resetControlsTimeout, triggerFeedback]);

  return (
    <div
      ref={playerContainerRef}
      className={`video-player-root ${isFullscreen ? "is-fullscreen" : ""} ${isFullscreen && !showControls ? "cursor-hidden" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseMove}
      style={
        isFullscreen
          ? {
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100vh",
              background: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              zIndex: 9999,
            }
          : {
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              width: "100%",
              position: "relative",
            }
      }
    >
      {/* 16:9 Video Canvas */}
      <div
        style={
          isFullscreen
            ? {
                position: "relative",
                width: "100vw",
                height: "100vh",
                maxWidth: "calc(100vh * 16 / 9)",
                maxHeight: "calc(100vw * 9 / 16)",
                aspectRatio: "16 / 9",
                background: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }
            : {
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#000",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                border: "1px solid var(--border-subtle)",
              }
        }
      >
        {/* YouTube IFrame Mount Target */}
        <div
          id="yt-player-container"
          style={{
            position: "absolute",
            inset: 0,
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
            resetControlsTimeout();
            if (!hasStartedGesture) {
              startPlaybackGesture();
            } else if (canControl) {
              isPlaying ? handlePause() : handlePlay();
            }
          }}
          onDoubleClick={handleFullscreen}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            background: "transparent",
            cursor: canControl ? "pointer" : "default",
          }}
        />

        {/* HUD Center Screen Indicator for Keyboard Shortcuts */}
        {feedback && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 40,
              background: "rgba(10, 13, 20, 0.8)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              borderRadius: "var(--radius-full)",
              padding: "0.85rem 1.4rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              color: "#fff",
              fontSize: "1.3rem",
              fontWeight: 700,
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              pointerEvents: "none",
              animation: "feedbackFade 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards",
            }}
          >
            <span>{feedback.icon}</span>
            {feedback.text && <span style={{ fontSize: "1rem", color: "var(--text-main)" }}>{feedback.text}</span>}
          </div>
        )}

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

      {/* Controls & Video Change Form Wrapper (Smooth auto-hide in fullscreen, inline in normal mode) */}
      <div
        className={`player-controls-wrapper ${isFullscreen ? "fullscreen-controls" : ""}`}
        onMouseEnter={resetControlsTimeout}
        onMouseMove={resetControlsTimeout}
        style={
          isFullscreen
            ? {
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 50,
                padding: "2rem 2.5rem 1.5rem",
                background: "linear-gradient(to top, rgba(10, 13, 20, 0.95) 0%, rgba(10, 13, 20, 0.8) 50%, rgba(10, 13, 20, 0.4) 80%, transparent 100%)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                opacity: showControls ? 1 : 0,
                transform: showControls ? "translateY(0)" : "translateY(16px)",
                pointerEvents: showControls ? "auto" : "none",
                transition: "opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }
            : {
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                width: "100%",
              }
        }
      >
        {/* Custom Control Bar */}
        <PlaybackControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          isMuted={isMuted}
          volume={volume}
          canControl={canControl}
          isFullscreen={isFullscreen}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          onToggleMute={toggleMute}
          onChangeVolume={changeVolume}
          onFullscreen={handleFullscreen}
        />

        {/* Video URL Input Form */}
        <div
          className="glass-panel"
          style={{
            padding: "0.75rem 1rem",
            ...(isFullscreen
              ? {
                  background: "rgba(15, 20, 34, 0.8)",
                  backdropFilter: "blur(16px)",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                }
              : {}),
          }}
        >
          <VideoUrlForm
            canControl={canControl}
            onRequestVideoChange={onRequestVideoChange}
            onVideoChangeSuccess={() => {
              if (!hasStartedGesture) {
                startPlaybackGesture();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};
