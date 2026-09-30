import { useEffect, useRef, useState, useCallback } from "react";
import type { VideoState, SyncStatePayload } from "../types";

// YouTube Player API typings
declare global {
  interface Window {
    YT: any;
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
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [hasStartedGesture, setHasStartedGesture] = useState(false);

  // Guards against echo loops when applying server-directed state changes
  const isApplyingRemoteRef = useRef(false);
  const currentVersionRef = useRef(0);
  const activeVideoIdRef = useRef(initialVideoId);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      const playerContainer = document.getElementById(containerId);
      if (!playerContainer) return;

      // Clean existing iframe if any
      playerContainer.innerHTML = "";
      const innerDiv = document.createElement("div");
      innerDiv.id = `${containerId}-inner`;
      playerContainer.appendChild(innerDiv);

      playerRef.current = new window.YT.Player(innerDiv.id, {
        videoId: initialVideoId,
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
            setIsReady(true);
            setDuration(event.target.getDuration() || 0);
            onPlayerReady?.();
          },
          onError: (event: any) => {
            console.warn("[YouTubePlayer] onError code:", event.data);
            onError?.(event.data);
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    }

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [containerId, initialVideoId]);

  // Polling local currentTime and duration every 250ms
  useEffect(() => {
    if (!isReady || !playerRef.current) return;

    const interval = setInterval(() => {
      try {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          const t = playerRef.current.getCurrentTime() || 0;
          setCurrentTime(t);
          const d = playerRef.current.getDuration() || 0;
          if (d > 0 && d !== duration) {
            setDuration(d);
          }
        }
      } catch {
        // Player might be re-buffering
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isReady, duration]);

  /**
   * Applies authoritative server state with drift correction and echo guard.
   */
  const applyRemoteState = useCallback(
    (state: VideoState | SyncStatePayload) => {
      if (!isReady || !playerRef.current) return;

      // Ignore older version packets
      if (state.version < currentVersionRef.current) {
        return;
      }
      currentVersionRef.current = state.version;

      isApplyingRemoteRef.current = true;

      // 1. Video change check
      if (state.videoId && state.videoId !== activeVideoIdRef.current) {
        activeVideoIdRef.current = state.videoId;
        if (typeof playerRef.current.loadVideoById === "function") {
          playerRef.current.loadVideoById({
            videoId: state.videoId,
            startSeconds: state.currentTime || 0,
          });
        }
      }

      // 2. Compute expected position
      let expectedPosition = state.currentTime;
      if ("updatedAt" in state && state.playState === "playing") {
        const elapsed = Math.max(0, (Date.now() - state.updatedAt) / 1000);
        expectedPosition = state.position + elapsed;
      } else if ("serverTime" in state && state.playState === "playing") {
        const elapsed = Math.max(0, (Date.now() - state.serverTime) / 1000);
        expectedPosition = state.currentTime + elapsed;
      }

      // 3. Drift correction: seek only if |local - expected| > 1.5 seconds
      let localTime = 0;
      try {
        localTime = playerRef.current.getCurrentTime() || 0;
      } catch {
        localTime = 0;
      }

      const drift = Math.abs(localTime - expectedPosition);
      if (drift > 1.5) {
        if (typeof playerRef.current.seekTo === "function") {
          playerRef.current.seekTo(expectedPosition, true);
        }
      }

      // 4. PlayState check
      if (state.playState === "playing") {
        if (typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      } else {
        if (typeof playerRef.current.pauseVideo === "function") {
          playerRef.current.pauseVideo();
        }
      }

      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 400);
    },
    [isReady]
  );

  const startPlaybackGesture = useCallback(() => {
    setHasStartedGesture(true);
    if (playerRef.current) {
      if (typeof playerRef.current.unMute === "function") {
        playerRef.current.unMute();
      }
      setIsMuted(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (isMuted) {
      playerRef.current.unMute?.();
      setIsMuted(false);
    } else {
      playerRef.current.mute?.();
      setIsMuted(true);
    }
  }, [isMuted]);

  const changeVolume = useCallback((newVol: number) => {
    if (!playerRef.current) return;
    const clamped = Math.max(0, Math.min(100, newVol));
    playerRef.current.setVolume?.(clamped);
    setVolume(clamped);
    if (clamped === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      playerRef.current.unMute?.();
      setIsMuted(false);
    }
  }, [isMuted]);

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
