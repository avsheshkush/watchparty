export const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts and validates an 11-character YouTube video ID from a URL or raw ID string.
 * Supports:
 * - https://www.youtube.com/watch?v=XXXXXXXXXXX
 * - https://youtu.be/XXXXXXXXXXX
 * - https://www.youtube.com/embed/XXXXXXXXXXX
 * - https://www.youtube.com/shorts/XXXXXXXXXXX
 * - Bare 11-character ID: XXXXXXXXXXX
 *
 * @param input URL or bare ID
 * @returns 11-char video ID if valid, null otherwise
 */
export function extractYouTubeId(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // If already an 11-char bare ID
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    // Attempt URL parsing (prepend https:// if missing schema)
    const urlString = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(urlString);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    // 1. youtu.be/ID
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0].split("?")[0];
      if (YOUTUBE_ID_REGEX.test(id)) return id;
    }

    // 2. youtube.com
    if (host === "youtube.com" || host === "m.youtube.com") {
      // /watch?v=ID
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v");
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }

      // /embed/ID
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }

      // /shorts/ID
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }

      // /live/ID
      if (url.pathname.startsWith("/live/")) {
        const id = url.pathname.split("/")[2]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }

      // /v/ID
      if (url.pathname.startsWith("/v/")) {
        const id = url.pathname.split("/")[2]?.split("?")[0];
        if (id && YOUTUBE_ID_REGEX.test(id)) return id;
      }
    }
  } catch {
    // Not a valid URL
  }

  return null;
}
