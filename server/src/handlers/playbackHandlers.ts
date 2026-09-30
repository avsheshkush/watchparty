import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { requirePermission } from "./guards";
import { playSchema, pauseSchema, seekSchema, changeVideoSchema } from "../validation/schemas";
import { extractYouTubeId } from "../utils/youtubeId";
import { AckCallback, errorAck, successAck } from "./ack";

export function registerPlaybackHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  // PLAY (Host, Moderator)
  socket.on("play", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = playSchema.safeParse(payload || {});
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid play payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "play", ack);
      if (!guard) return;

      const { room } = guard;
      const syncPayload = room.video.play(parsed.data.time);

      // Start 5-second interval heartbeat
      room.startHeartbeat((hbPayload) => {
        io.to(room.roomId).emit("sync_state", hbPayload);
      });

      // Broadcast to all clients in the room
      io.to(room.roomId).emit("sync_state", syncPayload);
      ack?.(successAck(syncPayload));
    } catch (err: unknown) {
      console.error("[play] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to play video"));
    }
  });

  // PAUSE (Host, Moderator)
  socket.on("pause", (_payload: unknown, ack?: AckCallback) => {
    try {
      const guard = requirePermission(socket, roomManager, "pause", ack);
      if (!guard) return;

      const { room } = guard;
      const syncPayload = room.video.pause();

      // Stop heartbeat when paused
      room.stopHeartbeat();

      io.to(room.roomId).emit("sync_state", syncPayload);
      ack?.(successAck(syncPayload));
    } catch (err: unknown) {
      console.error("[pause] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to pause video"));
    }
  });

  // SEEK (Host, Moderator)
  socket.on("seek", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = seekSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid seek payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "seek", ack);
      if (!guard) return;

      const { room } = guard;
      const syncPayload = room.video.seek(parsed.data.time);

      io.to(room.roomId).emit("sync_state", syncPayload);
      ack?.(successAck(syncPayload));
    } catch (err: unknown) {
      console.error("[seek] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to seek video"));
    }
  });

  // CHANGE VIDEO (Host, Moderator)
  socket.on("change_video", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = changeVideoSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid change_video payload"));
        return;
      }

      const rawInput = parsed.data.url || parsed.data.videoId || "";
      const videoId = extractYouTubeId(rawInput);
      if (!videoId) {
        ack?.(errorAck("INVALID_VIDEO", "Please enter a valid YouTube video URL or 11-character video ID"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "change_video", ack);
      if (!guard) return;

      const { room } = guard;
      const syncPayload = room.video.change(videoId);

      // Start heartbeat
      room.startHeartbeat((hbPayload) => {
        io.to(room.roomId).emit("sync_state", hbPayload);
      });

      io.to(room.roomId).emit("sync_state", syncPayload);
      ack?.(successAck(syncPayload));
    } catch (err: unknown) {
      console.error("[change_video] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to change video"));
    }
  });
}
