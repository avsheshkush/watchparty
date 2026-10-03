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

      const authUser = socket.data.authUser as { id: string; username: string } | undefined;
      const isDefaultTestUser = authUser?.id?.startsWith("test_");
      const effectiveClientId = authUser?.id || parsed.data.clientId;
      const effectiveUsername =
        !isDefaultTestUser && authUser?.username ? authUser.username : parsed.data.username || "Host";

      const { room, host } = roomManager.createRoom({
        username: effectiveUsername,
        clientId: effectiveClientId,
        socketId: socket.id,
        userId: authUser?.id,
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

      const authUser = socket.data.authUser as { id: string; username: string } | undefined;
      const isDefaultTestUser = authUser?.id?.startsWith("test_");
      const effectiveClientId = authUser?.id || parsed.data.clientId;
      const effectiveUsername =
        !isDefaultTestUser && authUser?.username ? authUser.username : parsed.data.username || "Guest";

      const newParticipant = new Participant({
        userId: authUser?.id || crypto.randomUUID(),
        clientId: effectiveClientId,
        socketId: socket.id,
        username: effectiveUsername,
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
        if (err instanceof Error && err.message === "BLOCKED_FROM_ROOM") {
          ack?.(errorAck("FORBIDDEN", "You have been removed from this room by the host"));
          return;
        }
        throw err;
      }

      socket.join(room.roomId);
      roomManager.bindSocket(socket.id, room.roomId, participant.userId);

      // Send full state to joiner
      socket.emit("room_state", {
        roomId: room.roomId,
        you: {
          userId: participant.userId,
          role: participant.role,
        },
        participants: room.getParticipantList(),
        videoState: room.video.toSnapshot(),
        pendingRequests: room.getPendingRequests(),
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
          username: participant.username,
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

      const wasHost = participant.userId === room.hostId;
      room.leave(participant.userId);
      roomManager.unbindSocket(socket.id);
      socket.leave(room.roomId);

      // If host left, trigger immediate succession per SPEC §12
      if (wasHost) {
        const succession = room.performHostSuccession();
        if (succession) {
          io.to(room.roomId).emit("host_transferred", {
            oldHostId: succession.oldHostId,
            newHostId: succession.newHostId,
            participants: room.getParticipantList(),
          });
        }
      }

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
    roomManager.unbindSocket(socket.id);
    if (!found) return;

    const { room, participant } = found;
    participant.disconnect();

    // If host disconnected, schedule 30-second succession grace period per SPEC §12
    if (participant.userId === room.hostId) {
      room.scheduleHostSuccession((oldHostId, newHostId) => {
        io.to(room.roomId).emit("host_transferred", {
          oldHostId,
          newHostId,
          participants: room.getParticipantList(),
        });
      });
    }

    io.to(room.roomId).emit("user_left", {
      username: participant.username,
      userId: participant.userId,
      participants: room.getParticipantList(),
    });
  });
}
