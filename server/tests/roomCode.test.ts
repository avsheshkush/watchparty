import { describe, it, expect } from "vitest";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRandomCode,
  generateRoomCode,
  normalizeRoomCode,
} from "../src/utils/roomCode";

describe("Room Code Generator", () => {
  it("should generate a code of exact length 6", () => {
    const code = generateRandomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("should only contain characters from the unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRandomCode();
      for (const char of code) {
        expect(ROOM_CODE_ALPHABET).toContain(char);
      }
      // Ensure confusing chars (0, O, 1, I) are never present
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it("should avoid collisions with existing codes", () => {
    const existing = new Set(["ABC234", "DEF567"]);
    const code = generateRoomCode((c) => existing.has(c));
    expect(existing.has(code)).toBe(false);
  });

  it("should normalize room codes by trimming and uppercasing", () => {
    expect(normalizeRoomCode("  abc234  ")).toBe("ABC234");
    expect(normalizeRoomCode("xyz987")).toBe("XYZ987");
  });
});
