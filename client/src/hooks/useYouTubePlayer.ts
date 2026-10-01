import { useEffect, useRef, useState, useCallback } from "react";
import type { VideoState, SyncStatePayload } from "../types";
import { useSocket } from "../context/SocketContext";

export interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  destroy(): void;
}

// YouTube Player API typings
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: unknown) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface UseYouTubePlayerProps {
  containerId: string;
  initialVideoId?: string;
  onPlayerReady?: () => void;
  onError?: (errorCode: number) => void;
}

export function useYouTubePlayer({
  containerId,
  initialVideoId = "jNQXAC9IVRw",
  onPlayerReady,
  onError,
}: UseYouTubePlayerProps) {
  const { getServerNow } = useSocket();
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [hasStartedGesture, setHasStartedGesture] = useState(false);

  // Guards against echo loops when applying server-directed state changes
  const isApplyingRemoteRef = useRef(false);
  const currentVersionRef = useRef(0);
  const initialVideoIdRef = useRef(initialVideoId);
  const activeVideoIdRef = useRef(initialVideoId);
  const pendingStateRef = useRef<VideoState | SyncStatePayload | null>(null);

  // Compute expected position safely with server clock calibration
  const computeExpectedPosition = useCallback(
    (state: VideoState | SyncStatePayload): number => {
      let expectedPosition = state.currentTime;
      const nowServer = getServerNow ? getServerNow() : Date.now();

      if ("updatedAt" in state && state.playState === "playing") {
        const elapsed = Math.max(0, (nowServer - state.updatedAt) / 1000);
        expectedPosition = state.position + elapsed;
      } else if ("serverTime" in state && state.playState === "playing") {
        const elapsed = Math.max(0, (nowServer - state.serverTime) / 1000);
        expectedPosition = state.currentTime + elapsed;
      }
      return Math.max(0, expectedPosition);
    },
    [getServerNow]
  );

  /**
   * Applies authoritative server state with drift correction and echo guard.
   */
  const applyRemoteState = useCallback(
    (state: VideoState | SyncStatePayload) => {
      if (!isReady || !playerRef.current) {
        // Queue state until player fires onReady
        pendingStateRef.current = state;
        return;
      }

      // Ignore older version packets
      if (state.version < currentVersionRef.current) {
        return;
      }
      currentVersionRef.current = state.version;

      isApplyingRemoteRef.current = true;

      try {
        const player = playerRef.current;
        if (!player) return;

        const expectedPosition = computeExpectedPosition(state);
        const isVideoChange = Boolean(state.videoId && state.videoId !== activeVideoIdRef.current);

        // 1. Video change check: use cueVideoById when paused to prevent unwanted autoplay
        if (isVideoChange && state.videoId) {
          activeVideoIdRef.current = state.videoId;
          if (state.playState === "playing") {
            if (typeof player.loadVideoById === "function") {
              player.loadVideoById({
                videoId: state.videoId,
                startSeconds: expectedPosition,
              });
            }
          } else {
            if (typeof player.cueVideoById === "function") {
              player.cueVideoById({
                videoId: state.videoId,
                startSeconds: expectedPosition,
              });
            }
          }
        } else {
          // 2. Drift correction (SPEC §7): seek only if |local - expected| > 1.5 seconds on same video
          let localTime = 0;
          try {
            localTime = typeof player.getCurrentTime === "function" ? player.getCurrentTime() || 0 : 0;
          } catch {
            localTime = 0;
          }

          const drift = Math.abs(localTime - expectedPosition);
          if (drift > 1.5) {
            if (typeof player.seekTo === "function") {
              player.seekTo(expectedPosition, true);
            }
          }

          // 3. PlayState check
          if (state.playState === "playing") {
            if (typeof player.playVideo === "function") {
              player.playVideo();
            }
          } else {
            if (typeof player.pauseVideo === "function") {
              player.pauseVideo();
            }
          }
        }
      } catch (err) {
        console.warn("[YouTubePlayer] error applying remote state:", err);
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 400);
      }
    },
    [isReady, computeExpectedPosition]
  );

  // Initialize YouTube IFrame API and Player ONCE per container mount
  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;
    let isDisposed = false;

    // Load YouTube script if not already added
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (isDisposed) return;
      if (!window.YT || !window.YT.Player) return;
      if (playerRef.current) return; // Player already initialized

      const playerContainer = document.getElementById(containerId);
      if (!playerContainer) return;

      // Clean existing inner content
      playerContainer.innerHTML = "";
      const innerDiv = document.createElement("div");
      innerDiv.id = `${containerId}-inner`;
      innerDiv.style.width = "100%";
      innerDiv.style.height = "100%";
      playerContainer.appendChild(innerDiv);

      try {
        playerRef.current = new window.YT.Player(innerDiv.id, {
          videoId: initialVideoIdRef.current,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
          },
          events: {
            onReady: (event: any) => {
              if (isDisposed) return;
              setIsReady(true);
              try {
                setDuration(event.target.getDuration() || 0);
              } catch {
                // Ignore duration read error
              }
              onPlayerReady?.();

              // If a remote state arrived while initializing, apply it immediately
              if (pendingStateRef.current) {
                const queued = pendingStateRef.current;
                pendingStateRef.current = null;
                applyRemoteState(queued);
              }
            },
            onError: (event: any) => {
              console.warn("[YouTubePlayer] onError code:", event.data);
              onError?.(event.data);
            },
          },
        });
      } catch (err) {
        console.error("[YouTubePlayer] Player constructor error:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        initPlayer();
      };

      // Polling fallback in case API was already ready before handler registered
      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          if (checkInterval) clearInterval(checkInterval);
          initPlayer();
        }
      }, 150);
    }

    return () => {
      isDisposed = true;
      if (checkInterval) clearInterval(checkInterval);
      try {
        if (playerRef.current && typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
      } catch (err) {
        console.warn("[YouTubePlayer] destroy error:", err);
      }
      playerRef.current = null;
      setIsReady(false);
    };
  }, [containerId, onPlayerReady, onError, applyRemoteState]);

  // Polling local currentTime and duration every 250ms
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const interval = setInterval(() => {
      try {
        const player = playerRef.current;
        if (player && typeof player.getCurrentTime === "function") {
          const t = player.getCurrentTime() || 0;
          setCurrentTime(t);
          const d = typeof player.getDuration === "function" ? player.getDuration() || 0 : 0;
          if (d > 0 && d !== duration) {
            setDuration(d);
          }
        }
      } catch {
        // Player might be re-buffering or switching videos
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isReady, duration]);

  const startPlaybackGesture = useCallback(() => {
    setHasStartedGesture(true);
    try {
      if (playerRef.current) {
        if (typeof playerRef.current.unMute === "function") {
          playerRef.current.unMute();
        }
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
        setIsMuted(false);
      }
    } catch (err) {
      console.warn("[YouTubePlayer] startPlaybackGesture error:", err);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute?.();
        setIsMuted(false);
      } else {
        playerRef.current.mute?.();
        setIsMuted(true);
      }
    } catch (err) {
      console.warn("[YouTubePlayer] toggleMute error:", err);
    }
  }, [isMuted]);

  const changeVolume = useCallback(
    (newVol: number) => {
      if (!playerRef.current) return;
      const clamped = Math.max(0, Math.min(100, newVol));
      try {
        playerRef.current.setVolume?.(clamped);
        setVolume(clamped);
        if (clamped === 0) {
          setIsMuted(true);
        } else if (isMuted) {
          playerRef.current.unMute?.();
          setIsMuted(false);
        }
      } catch (err) {
        console.warn("[YouTubePlayer] changeVolume error:", err);
      }
    },
    [isMuted]
  );

  return {
    isReady,
    currentTime,
    duration,
    isMuted,
    volume,
    hasStartedGesture,
    isApplyingRemote: isApplyingRemoteRef.current,
    startPlaybackGesture,
    applyRemoteState,
    toggleMute,
    changeVolume,
  };
}
