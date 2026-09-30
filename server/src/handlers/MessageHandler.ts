import { Server, Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { registerRoomHandlers } from "./roomHandlers";

export class MessageHandler {
  private io: Server;
  private roomManager: RoomManager;

  constructor(io: Server, roomManager: RoomManager) {
    this.io = io;
    this.roomManager = roomManager;
  }

  /**
   * Registers all incoming event handlers on a newly connected socket.
   */
  public register(socket: Socket): void {
    // Phase 1: Room handlers (create, join, leave, disconnect)
    registerRoomHandlers(this.io, socket, this.roomManager);
  }
}
