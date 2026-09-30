import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { requirePermission } from "./guards";
import { assignRoleSchema, removeParticipantSchema, transferHostSchema } from "../validation/schemas";
import { AckCallback, errorAck, successAck } from "./ack";

export function registerRoleHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  // ASSIGN ROLE (Host only)
  socket.on("assign_role", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = assignRoleSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid assign_role payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "assign_role", ack);
      if (!guard) return;

      const { room, actor } = guard;

      try {
        const updatedTarget = room.assignRole(actor.userId, parsed.data.userId, parsed.data.role);

        io.to(room.roomId).emit("role_assigned", {
          userId: updatedTarget.userId,
          username: updatedTarget.username,
          role: updatedTarget.role,
          participants: room.getParticipantList(),
        });

        ack?.(successAck({ userId: updatedTarget.userId, role: updatedTarget.role }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to assign role";
        ack?.(errorAck("FORBIDDEN", msg));
      }
    } catch (err: unknown) {
      console.error("[assign_role] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Internal error"));
    }
  });

  // REMOVE PARTICIPANT (Host only)
  socket.on("remove_participant", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = removeParticipantSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", "Invalid remove_participant payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "remove_participant", ack);
      if (!guard) return;

      const { room, actor } = guard;
      const target = room.getParticipant(parsed.data.userId);

      if (!target) {
        ack?.(errorAck("REQUEST_NOT_FOUND", "Target participant not found"));
        return;
      }

      try {
        // Disconnect and notify target socket if still connected
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit("removed", { reason: "Removed by room host" });
          targetSocket.leave(room.roomId);
        }

        room.removeParticipant(actor.userId, target.userId);

        io.to(room.roomId).emit("participant_removed", {
          userId: target.userId,
          participants: room.getParticipantList(),
        });

        ack?.(successAck({ removed: true }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to remove participant";
        ack?.(errorAck("FORBIDDEN", msg));
      }
    } catch (err: unknown) {
      console.error("[remove_participant] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Internal error"));
    }
  });

  // TRANSFER HOST (Host only)
  socket.on("transfer_host", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = transferHostSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", "Invalid transfer_host payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "transfer_host", ack);
      if (!guard) return;

      const { room, actor } = guard;

      try {
        const { oldHost, newHost } = room.transferHost(actor.userId, parsed.data.userId);

        io.to(room.roomId).emit("host_transferred", {
          oldHostId: oldHost.userId,
          newHostId: newHost.userId,
          participants: room.getParticipantList(),
        });

        ack?.(successAck({ hostTransferred: true, newHostId: newHost.userId }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to transfer host";
        ack?.(errorAck("FORBIDDEN", msg));
      }
    } catch (err: unknown) {
      console.error("[transfer_host] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Internal error"));
    }
  });
}
