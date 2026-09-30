import crypto from "crypto";
import { Room } from "./Room";
import { Participant } from "./Participant";
import { generateRoomCode, normalizeRoomCode } from "../utils/roomCode";

export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes per SPEC §12

export class RoomManager {
  private readonly rooms: Map<string, Room>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.rooms = new Map<string, Room>();
    this.cleanupInterval = setInterval(() => this.cleanupEmptyRooms(), 60 * 1000);
    // Ensure timer doesn't keep node event loop open when exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Creates a new room with the creator as Host.
   */
  public createRoom(params: {
    username: string;
    clientId: string;
    socketId: string;
  }): { room: Room; host: Participant } {
    const roomId = generateRoomCode((code) => this.rooms.has(code));
    const userId = crypto.randomUUID();

    const host = new Participant({
      userId,
      clientId: params.clientId,
      socketId: params.socketId,
      username: params.username,
      role: "host",
    });

    const room = new Room(roomId, host);
    this.rooms.set(roomId, room);

    return { room, host };
  }

  /**
   * Retrieves an existing room by normalized ID.
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(normalizeRoomCode(roomId));
  }

  /**
   * Deletes a room manually.
   */
  public deleteRoom(roomId: string): boolean {
    const normalized = normalizeRoomCode(roomId);
    const room = this.rooms.get(normalized);
    if (room) {
      room.destroy();
      return this.rooms.delete(normalized);
    }
    return false;
  }

  /**
   * Finds the room and participant associated with a given socket ID.
   */
  public findBySocket(socketId: string): { room: Room; participant: Participant } | undefined {
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocket(socketId);
      if (participant) {
        return { room, participant };
      }
    }
    return undefined;
  }

  /**
   * Cleans up rooms that have been completely empty for longer than EMPTY_ROOM_TTL_MS.
   */
  public cleanupEmptyRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.isEmpty() && now - room.lastActiveAt > EMPTY_ROOM_TTL_MS) {
        console.log(`[RoomManager] Cleaning up stale empty room: ${roomId}`);
        room.destroy();
        this.rooms.delete(roomId);
      }
    }
  }

  public get activeRoomCount(): number {
    return this.rooms.size;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const room of this.rooms.values()) {
      room.destroy();
    }
    this.rooms.clear();
  }
}
