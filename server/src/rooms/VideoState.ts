export type PlayState = "playing" | "paused";

export interface SyncStatePayload {
  playState: PlayState;
  currentTime: number;
  videoId: string;
  version: number;
  serverTime: number;
}

export interface VideoStateSnapshot {
  videoId: string;
  playState: PlayState;
  position: number;
  currentTime: number;
  updatedAt: number;
  version: number;
}

// Default initial video: YouTube's "Me at the zoo" (universal embed permitted)
export const DEFAULT_VIDEO_ID = "jNQXAC9IVRw";

export class VideoState {
  public videoId: string;
  public playState: PlayState;
  public position: number; // Anchor timestamp (seconds)
  public updatedAt: number; // Server timestamp when position was anchored
  public version: number;

  constructor(initialVideoId: string = DEFAULT_VIDEO_ID) {
    this.videoId = initialVideoId;
    this.playState = "paused";
    this.position = 0;
    this.updatedAt = Date.now();
    this.version = 1;
  }

  /**
   * Computes the current effective playback position in seconds based on elapsed server time.
   */
  public getEffectivePosition(atMs: number = Date.now()): number {
    if (this.playState === "playing") {
      const elapsedSeconds = Math.max(0, (atMs - this.updatedAt) / 1000);
      return this.position + elapsedSeconds;
    }
    return this.position;
  }

  /**
   * Initiates playback. Optionally re-anchors to a specified time.
   */
  public play(time?: number): SyncStatePayload {
    if (time !== undefined && Number.isFinite(time)) {
      this.position = Math.max(0, time);
    } else if (this.playState === "paused") {
      // Re-anchor to current paused position
      this.position = this.getEffectivePosition();
    }
    this.playState = "playing";
    this.updatedAt = Date.now();
    this.version += 1;
    return this.toSyncPayload();
  }

  /**
   * Pauses playback and freezes effective position at current moment.
   */
  public pause(): SyncStatePayload {
    this.position = this.getEffectivePosition();
    this.playState = "paused";
    this.updatedAt = Date.now();
    this.version += 1;
    return this.toSyncPayload();
  }

  /**
   * Seeks to a specific timestamp, maintaining current playState.
   */
  public seek(time: number): SyncStatePayload {
    this.position = Math.max(0, time);
    this.updatedAt = Date.now();
    this.version += 1;
    return this.toSyncPayload();
  }

  /**
   * Changes the active video, resetting position to 0 and starting in 'playing' state per SPEC §7.
   */
  public change(videoId: string): SyncStatePayload {
    this.videoId = videoId;
    this.position = 0;
    this.playState = "playing";
    this.updatedAt = Date.now();
    this.version += 1;
    return this.toSyncPayload();
  }

  /**
   * Generates the standard sync_state broadcast payload.
   */
  public toSyncPayload(): SyncStatePayload {
    const now = Date.now();
    return {
      playState: this.playState,
      currentTime: Number(this.getEffectivePosition(now).toFixed(2)),
      videoId: this.videoId,
      version: this.version,
      serverTime: now,
    };
  }

  public toSnapshot(): VideoStateSnapshot {
    return {
      videoId: this.videoId,
      playState: this.playState,
      position: this.position,
      currentTime: Number(this.getEffectivePosition().toFixed(2)),
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
