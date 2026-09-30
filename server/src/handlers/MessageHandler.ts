import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { SocketRateLimiter } from "../utils/rateLimiter";
import { registerRoomHandlers } from "./roomHandlers";
import { registerRoleHandlers } from "./roleHandlers";
import { registerPlaybackHandlers } from "./playbackHandlers";
import { registerRequestHandlers } from "./requestHandlers";
import { errorAck } from "./ack";

export class MessageHandler {
  private io: Server;
  private roomManager: RoomManager;
  public readonly rateLimiter: SocketRateLimiter;

  constructor(io: Server, roomManager: RoomManager, rateLimiter?: SocketRateLimiter) {
    this.io = io;
    this.roomManager = roomManager;
    this.rateLimiter = rateLimiter || new SocketRateLimiter(20, 10);
  }

  /**
   * Registers all incoming event handlers on a newly connected socket.
   */
  public register(socket: Socket): void {
    // Intercept packets with rate limiter per SPEC §12
    socket.use(([event, ...args], next) => {
      if (event === "ping") {
        return next();
      }

      if (!this.rateLimiter.allow(socket.id)) {
        const ack = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;
        if (ack) {
          ack(errorAck("RATE_LIMITED", "Too many requests. Please slow down."));
        } else {
          socket.emit("error", { code: "RATE_LIMITED", message: "Too many requests. Please slow down." });
        }
        return; // drop event, do not call next()
      }

      next();
    });

    socket.on("disconnect", () => {
      this.rateLimiter.remove(socket.id);
    });

    // Phase 1: Room handlers (create, join, leave, disconnect)
    registerRoomHandlers(this.io, socket, this.roomManager);

    // Phase 2: Role handlers (assign_role, remove_participant, transfer_host)
    registerRoleHandlers(this.io, socket, this.roomManager);

    // Phase 3: Playback sync handlers (play, pause, seek, change_video)
    registerPlaybackHandlers(this.io, socket, this.roomManager);

    // Phase 6: Request & Approval handlers (action_request, resolve_request)
    registerRequestHandlers(this.io, socket, this.roomManager);
  }
}
