import crypto from "crypto";
import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { Participant } from "../rooms/Participant";
import { createRoomSchema, joinRoomSchema, leaveRoomSchema } from "../validation/schemas";
import { AckCallback, errorAck, successAck } from "./ack";

export function registerRoomHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  // CREATE ROOM
  socket.on("create_room", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = createRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid payload"));
        return;
      }

      const { room, host } = roomManager.createRoom({
        username: parsed.data.username,
        clientId: parsed.data.clientId,
        socketId: socket.id,
      });

      socket.join(room.roomId);

      ack?.(
        successAck({
          roomId: room.roomId,
          userId: host.userId,
          role: host.role,
          state: room.toSnapshot(),
        })
      );
    } catch (err: unknown) {
      console.error("[create_room] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to create room"));
    }
  });

  // JOIN ROOM
  socket.on("join_room", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = joinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid payload"));
        return;
      }

      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        ack?.(errorAck("ROOM_NOT_FOUND", `Room ${parsed.data.roomId} does not exist`));
        return;
      }

      const newParticipant = new Participant({
        userId: crypto.randomUUID(),
        clientId: parsed.data.clientId,
        socketId: socket.id,
        username: parsed.data.username,
        role: "participant",
      });

      let participant: Participant;
      try {
        const result = room.join(newParticipant);
        participant = result.participant;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "ROOM_FULL") {
          ack?.(errorAck("ROOM_FULL", "Room is at maximum capacity (50 participants)"));
          return;
        }
        throw err;
      }

      socket.join(room.roomId);

      // Send full state to joiner
      socket.emit("room_state", {
        roomId: room.roomId,
        you: {
          userId: participant.userId,
          role: participant.role,
        },
        participants: room.getParticipantList(),
      });

      // Broadcast to everyone else in the room
      socket.to(room.roomId).emit("user_joined", {
        username: participant.username,
        userId: participant.userId,
        role: participant.role,
        participants: room.getParticipantList(),
      });

      ack?.(
        successAck({
          roomId: room.roomId,
          userId: participant.userId,
          role: participant.role,
        })
      );
    } catch (err: unknown) {
      console.error("[join_room] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to join room"));
    }
  });

  // LEAVE ROOM
  socket.on("leave_room", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = leaveRoomSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", "Invalid leave payload"));
        return;
      }

      const room = roomManager.getRoom(parsed.data.roomId);
      if (!room) {
        ack?.(errorAck("ROOM_NOT_FOUND", "Room not found"));
        return;
      }

      const participant = room.getParticipantBySocket(socket.id);
      if (!participant) {
        ack?.(errorAck("NOT_IN_ROOM", "You are not in this room"));
        return;
      }

      room.leave(participant.userId);
      socket.leave(room.roomId);

      io.to(room.roomId).emit("user_left", {
        username: participant.username,
        userId: participant.userId,
        participants: room.getParticipantList(),
      });

      ack?.(successAck({ left: true }));
    } catch (err: unknown) {
      console.error("[leave_room] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to leave room"));
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const found = roomManager.findBySocket(socket.id);
    if (!found) return;

    const { room, participant } = found;
    // For Phase 1, we mark as disconnected and broadcast updated list
    participant.disconnect();

    io.to(room.roomId).emit("user_left", {
      username: participant.username,
      userId: participant.userId,
      participants: room.getParticipantList(),
    });
  });
}
