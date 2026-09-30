import { describe, it, expect, beforeEach, vi } from "vitest";
import { VideoState } from "../src/rooms/VideoState";

describe("VideoState Playback Math & Transitions", () => {
  let videoState: VideoState;

  beforeEach(() => {
    videoState = new VideoState("TEST_VIDEO_1");
  });

  it("should initialize in paused state at position 0", () => {
    expect(videoState.videoId).toBe("TEST_VIDEO_1");
    expect(videoState.playState).toBe("paused");
    expect(videoState.position).toBe(0);
    expect(videoState.version).toBe(1);
    expect(videoState.getEffectivePosition()).toBe(0);
  });

  it("should calculate effective position correctly while playing", () => {
    const startTime = 1000000;
    vi.setSystemTime(startTime);

    videoState.play(10); // Start playing at 10s
    expect(videoState.playState).toBe("playing");
    expect(videoState.getEffectivePosition()).toBe(10);

    // Advance 5 seconds
    vi.setSystemTime(startTime + 5000);
    expect(videoState.getEffectivePosition()).toBe(15);

    // Pause at 15s
    videoState.pause();
    expect(videoState.playState).toBe("paused");
    expect(videoState.position).toBe(15);

    // Advance 10 more seconds while paused - position should stay frozen
    vi.setSystemTime(startTime + 15000);
    expect(videoState.getEffectivePosition()).toBe(15);

    vi.useRealTimers();
  });

  it("should handle seeking while paused and while playing", () => {
    // Seek while paused
    videoState.seek(30);
    expect(videoState.playState).toBe("paused");
    expect(videoState.position).toBe(30);

    // Seek while playing
    videoState.play();
    videoState.seek(60);
    expect(videoState.playState).toBe("playing");
    expect(videoState.position).toBe(60);
  });

  it("should reset position to 0 and switch to playing on video change", () => {
    videoState.seek(120);
    expect(videoState.position).toBe(120);

    videoState.change("NEW_VIDEO_ID");
    expect(videoState.videoId).toBe("NEW_VIDEO_ID");
    expect(videoState.position).toBe(0);
    expect(videoState.playState).toBe("playing");
  });

  it("should increment version on every state mutation", () => {
    const v1 = videoState.version;
    videoState.play();
    expect(videoState.version).toBe(v1 + 1);
    videoState.seek(10);
    expect(videoState.version).toBe(v1 + 2);
    videoState.pause();
    expect(videoState.version).toBe(v1 + 3);
    videoState.change("ANOTHER_ID");
    expect(videoState.version).toBe(v1 + 4);
  });
});
