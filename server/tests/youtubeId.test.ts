import { describe, it, expect } from "vitest";
import { extractYouTubeId } from "../src/utils/youtubeId";

describe("YouTube ID Extraction & Validation", () => {
  const validId = "dQw4w9WgXcQ";

  it("should extract bare 11-char ID", () => {
    expect(extractYouTubeId(validId)).toBe(validId);
    expect(extractYouTubeId("jNQXAC9IVRw")).toBe("jNQXAC9IVRw");
  });

  it("should extract from youtube.com/watch?v=ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/watch?v=${validId}`)).toBe(validId);
    expect(extractYouTubeId(`http://youtube.com/watch?v=${validId}&t=42s`)).toBe(validId);
  });

  it("should extract from youtu.be/ID", () => {
    expect(extractYouTubeId(`https://youtu.be/${validId}`)).toBe(validId);
    expect(extractYouTubeId(`http://youtu.be/${validId}?t=10`)).toBe(validId);
  });

  it("should extract from youtube.com/embed/ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/embed/${validId}`)).toBe(validId);
  });

  it("should extract from youtube.com/shorts/ID", () => {
    expect(extractYouTubeId(`https://www.youtube.com/shorts/${validId}`)).toBe(validId);
  });

  it("should reject invalid, malformed, or malicious inputs", () => {
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("not-a-youtube-url")).toBeNull();
    expect(extractYouTubeId("https://vimeo.com/12345678")).toBeNull();
    expect(extractYouTubeId("https://youtube.com/watch?v=tooShort")).toBeNull();
    expect(extractYouTubeId("https://youtube.com/watch?v=wayTooLong123456")).toBeNull();
    expect(extractYouTubeId("<script>alert(1)</script>")).toBeNull();
  });
});
