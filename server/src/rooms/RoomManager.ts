import crypto from "crypto";
import { Room } from "./Room";
import { Participant } from "./Participant";
import { generateRoomCode, normalizeRoomCode } from "../utils/roomCode";

export const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes per SPEC §12

export class RoomManager {
  private readonly rooms: Map<string, Room>;
  private readonly socketIndex: Map<string, { roomId: string; userId: string }>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.rooms = new Map<string, Room>();
    this.socketIndex = new Map<string, { roomId: string; userId: string }>();
    this.cleanupInterval = setInterval(() => this.cleanupEmptyRooms(), 60 * 1000);
    // Ensure timer doesn't keep node event loop open when exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Binds a socket ID to a room and user for O(1) lookup.
   */
  public bindSocket(socketId: string, roomId: string, userId: string): void {
    this.socketIndex.set(socketId, { roomId, userId });
  }

  /**
   * Removes a socket binding from the index.
   */
  public unbindSocket(socketId: string): void {
    this.socketIndex.delete(socketId);
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
    this.bindSocket(params.socketId, roomId, userId);

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
      // Clear socket indices for this room
      for (const [sId, entry] of this.socketIndex.entries()) {
        if (entry.roomId === normalized) {
          this.socketIndex.delete(sId);
        }
      }
      room.destroy();
      return this.rooms.delete(normalized);
    }
    return false;
  }

  /**
   * Finds the room and participant associated with a given socket ID in O(1) time.
   */
  public findBySocket(socketId: string): { room: Room; participant: Participant } | undefined {
    // Fast path: O(1) reverse index lookup
    const entry = this.socketIndex.get(socketId);
    if (entry) {
      const room = this.rooms.get(entry.roomId);
      if (room) {
        const participant = room.getParticipant(entry.userId);
        if (participant && participant.socketId === socketId) {
          return { room, participant };
        }
      }
      this.socketIndex.delete(socketId);
    }

    // Resilient fallback (e.g. in test suites that manipulate rooms directly)
    for (const room of this.rooms.values()) {
      const participant = room.getParticipantBySocket(socketId);
      if (participant) {
        this.bindSocket(socketId, room.roomId, participant.userId);
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
        // Clear socket index for this room
        for (const [sId, entry] of this.socketIndex.entries()) {
          if (entry.roomId === roomId) {
            this.socketIndex.delete(sId);
          }
        }
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
