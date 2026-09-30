import crypto from "crypto";

// Unambiguous alphabet without confusing characters: 0, O, 1, I
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

/**
 * Generates a random 6-character room code using unambiguous characters.
 */
export function generateRandomCode(): string {
  const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = bytes[i] % ROOM_CODE_ALPHABET.length;
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

/**
 * Generates a unique room code, ensuring no collision with existing rooms.
 * @param existsFn A function returning true if the room code is already active.
 * @param maxAttempts Maximum attempts before throwing an error.
 */
export function generateRoomCode(existsFn: (code: string) => boolean, maxAttempts = 100): string {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateRandomCode();
    if (!existsFn(code)) {
      return code;
    }
  }
  throw new Error("Failed to generate a unique room code after maximum attempts");
}

/**
 * Normalizes user input room code (uppercases and trims).
 */
export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}
