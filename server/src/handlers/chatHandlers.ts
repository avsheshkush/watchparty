import crypto from "crypto";
import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { chatMessageSchema, reactionSchema } from "../validation/schemas";
import { AckCallback, errorAck, successAck } from "./ack";
import { SocketRateLimiter } from "../utils/rateLimiter";

export interface ChatMessageBroadcast {
  id: string;
  userId: string;
  username: string;
  role: string;
  text: string;
  timestamp: number;
}

export interface ReactionBroadcast {
  id: string;
  userId: string;
  username: string;
  emoji: string;
  timestamp: number;
}

export function registerChatHandlers(
  io: Server,
  socket: Socket,
  roomManager: RoomManager,
  chatRateLimiter: SocketRateLimiter
): void {
  // CHAT MESSAGE
  socket.on("chat_message", (payload: unknown, ack?: AckCallback) => {
    try {
      const found = roomManager.findBySocket(socket.id);
      if (!found) {
        ack?.(errorAck("NOT_IN_ROOM", "You must join a room before sending messages"));
        return;
      }

      const { room, participant } = found;

      if (!chatRateLimiter.allow(socket.id)) {
        ack?.(errorAck("RATE_LIMITED", "You are sending messages too quickly. Please wait a moment."));
        return;
      }

      const parsed = chatMessageSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid chat message"));
        return;
      }

      const message: ChatMessageBroadcast = {
        id: crypto.randomUUID(),
        userId: participant.userId,
        username: participant.username,
        role: participant.role,
        text: parsed.data.text,
        timestamp: Date.now(),
      };

      io.to(room.roomId).emit("chat_message", message);
      ack?.(successAck(message));
    } catch (err: unknown) {
      console.error("[chat_message] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to send chat message"));
    }
  });

  // REACTION
  socket.on("reaction", (payload: unknown, ack?: AckCallback) => {
    try {
      const found = roomManager.findBySocket(socket.id);
      if (!found) {
        ack?.(errorAck("NOT_IN_ROOM", "You must join a room before reacting"));
        return;
      }

      const { room, participant } = found;

      const parsed = reactionSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid reaction emoji"));
        return;
      }

      const reaction: ReactionBroadcast = {
        id: crypto.randomUUID(),
        userId: participant.userId,
        username: participant.username,
        emoji: parsed.data.emoji,
        timestamp: Date.now(),
      };

      io.to(room.roomId).emit("reaction", reaction);
      ack?.(successAck(reaction));
    } catch (err: unknown) {
      console.error("[reaction] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to send reaction"));
    }
  });
}
