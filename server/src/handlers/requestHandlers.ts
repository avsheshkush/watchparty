import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { requirePermission } from "./guards";
import { actionRequestSchema, resolveRequestSchema } from "../validation/schemas";
import { extractYouTubeId } from "../utils/youtubeId";
import { AckCallback, errorAck, successAck } from "./ack";

export function registerRequestHandlers(io: Server, socket: Socket, roomManager: RoomManager): void {
  // ACTION REQUEST (Participants propose changes)
  socket.on("action_request", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = actionRequestSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", parsed.error.issues[0]?.message || "Invalid request payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "action_request", ack);
      if (!guard) return;

      const { room, actor } = guard;

      // Extract and validate YouTube ID if requesting video change
      let requestPayload = parsed.data.payload;
      if (parsed.data.type === "change_video") {
        const rawInput = requestPayload.url || requestPayload.videoId || "";
        const videoId = extractYouTubeId(rawInput);
        if (!videoId) {
          ack?.(errorAck("INVALID_VIDEO", "Invalid YouTube video URL or ID"));
          return;
        }
        requestPayload = { ...requestPayload, videoId };
      }

      try {
        const newRequest = room.createRequest(actor, parsed.data.type, requestPayload);

        // Broadcast request_created ONLY to Host and Moderators per SPEC §5
        for (const p of room.participants.values()) {
          if (p.role === "host" || p.role === "moderator") {
            io.to(p.socketId).emit("request_created", newRequest);
          }
        }

        ack?.(successAck({ requestId: newRequest.requestId }));
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "MAX_PENDING_REQUESTS") {
          ack?.(errorAck("RATE_LIMITED", "Maximum 3 pending requests allowed per user"));
          return;
        }
        throw err;
      }
    } catch (err: unknown) {
      console.error("[action_request] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to submit request"));
    }
  });

  // RESOLVE REQUEST (Host / Moderator approves or rejects)
  socket.on("resolve_request", (payload: unknown, ack?: AckCallback) => {
    try {
      const parsed = resolveRequestSchema.safeParse(payload);
      if (!parsed.success) {
        ack?.(errorAck("INVALID_PAYLOAD", "Invalid resolve_request payload"));
        return;
      }

      const guard = requirePermission(socket, roomManager, "resolve_request", ack);
      if (!guard) return;

      const { room, actor } = guard;

      try {
        const { request, syncPayload } = room.resolveRequest(
          actor,
          parsed.data.requestId,
          parsed.data.approve
        );

        // If approved and playback changed, broadcast sync_state to room
        if (parsed.data.approve && syncPayload) {
          if (syncPayload.playState === "playing") {
            room.startHeartbeat((hbPayload) => {
              io.to(room.roomId).emit("sync_state", hbPayload);
            });
          } else {
            room.stopHeartbeat();
          }
          io.to(room.roomId).emit("sync_state", syncPayload);
        }

        // Notify room members (requester + mods to clear their queues)
        io.to(room.roomId).emit("request_resolved", {
          requestId: request.requestId,
          approved: parsed.data.approve,
          actionType: request.type,
          fromUserId: request.fromUserId,
        });

        ack?.(
          successAck({
            requestId: request.requestId,
            approved: parsed.data.approve,
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to resolve request";
        if (msg === "REQUEST_NOT_FOUND" || msg === "REQUEST_EXPIRED") {
          ack?.(errorAck("REQUEST_NOT_FOUND", "Request not found or expired"));
        } else {
          ack?.(errorAck("FORBIDDEN", msg));
        }
      }
    } catch (err: unknown) {
      console.error("[resolve_request] error:", err);
      ack?.(errorAck("INTERNAL_ERROR", "Failed to resolve request"));
    }
  });
}
