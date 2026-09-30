import { Participant, ParticipantSnapshot } from "./Participant";

export const MAX_PARTICIPANTS = 50;

export interface RoomSnapshot {
  roomId: string;
  hostId: string;
  participants: ParticipantSnapshot[];
  createdAt: number;
}

export class Room {
  public readonly roomId: string;
  public hostId: string;
  public readonly participants: Map<string, Participant>; // userId -> Participant
  public readonly createdAt: number;
  public lastActiveAt: number;

  constructor(roomId: string, initialHost: Participant) {
    this.roomId = roomId;
    this.hostId = initialHost.userId;
    this.participants = new Map<string, Participant>();
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();

    // Initial host setup
    initialHost.role = "host";
    this.participants.set(initialHost.userId, initialHost);
  }

  /**
   * Adds or reconnects a participant.
   */
  public join(participant: Participant): { participant: Participant; isReconnect: boolean } {
    this.touch();

    // Check if clientId already exists (reconnection)
    const existing = this.getParticipantByClientId(participant.clientId);
    if (existing) {
      existing.reconnect(participant.socketId);
      // Update username if provided
      if (participant.username && participant.username.trim().length > 0) {
        existing.username = participant.username;
      }
      return { participant: existing, isReconnect: true };
    }

    if (this.participants.size >= MAX_PARTICIPANTS) {
      throw new Error("ROOM_FULL");
    }

    this.participants.set(participant.userId, participant);
    return { participant, isReconnect: false };
  }

  /**
   * Promotes or demotes a participant (Host only).
   */
  public assignRole(actorId: string, targetId: string, role: "moderator" | "participant"): Participant {
    this.touch();
    const actor = this.participants.get(actorId);
    if (!actor || actor.role !== "host") {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("CANNOT_MODIFY_SELF");
    }

    const target = this.participants.get(targetId);
    if (!target) {
      throw new Error("TARGET_NOT_FOUND");
    }

    if (target.userId === this.hostId) {
      throw new Error("CANNOT_MODIFY_HOST");
    }

    target.role = role;
    return target;
  }

  /**
   * Removes a participant from the room (Host only).
   */
  public removeParticipant(actorId: string, targetId: string): Participant {
    this.touch();
    const actor = this.participants.get(actorId);
    if (!actor || actor.role !== "host") {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("CANNOT_REMOVE_SELF");
    }

    if (targetId === this.hostId) {
      throw new Error("CANNOT_REMOVE_HOST");
    }

    const target = this.participants.get(targetId);
    if (!target) {
      throw new Error("TARGET_NOT_FOUND");
    }

    this.participants.delete(targetId);
    return target;
  }

  /**
   * Transfers room ownership to another participant.
   * Old host becomes Moderator.
   */
  public transferHost(actorId: string, targetId: string): { oldHost: Participant; newHost: Participant } {
    this.touch();
    if (actorId !== this.hostId) {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("ALREADY_HOST");
    }

    const oldHost = this.participants.get(actorId);
    const newHost = this.participants.get(targetId);

    if (!oldHost || !newHost) {
      throw new Error("PARTICIPANT_NOT_FOUND");
    }

    oldHost.role = "moderator";
    newHost.role = "host";
    this.hostId = targetId;

    return { oldHost, newHost };
  }

  /**
   * Removes a participant completely from the room.
   */
  public leave(userId: string): Participant | null {
    this.touch();
    const p = this.participants.get(userId);
    if (p) {
      this.participants.delete(userId);
      return p;
    }
    return null;
  }

  /**
   * Marks a participant as temporarily disconnected.
   */
  public disconnectParticipant(socketId: string): Participant | null {
    this.touch();
    const p = this.getParticipantBySocket(socketId);
    if (p) {
      p.disconnect();
      return p;
    }
    return null;
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocket(socketId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.socketId === socketId) {
        return p;
      }
    }
    return undefined;
  }

  public getParticipantByClientId(clientId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.clientId === clientId) {
        return p;
      }
    }
    return undefined;
  }

  /**
   * Returns participant snapshots sorted by join time (host first).
   */
  public getParticipantList(): ParticipantSnapshot[] {
    return Array.from(this.participants.values())
      .sort((a, b) => {
        if (a.role === "host") return -1;
        if (b.role === "host") return 1;
        return a.joinedAt - b.joinedAt;
      })
      .map((p) => p.toSnapshot());
  }

  public touch(): void {
    this.lastActiveAt = Date.now();
  }

  public isEmpty(): boolean {
    // Empty if no connected participants
    return !Array.from(this.participants.values()).some((p) => p.connected);
  }

  public toSnapshot(): RoomSnapshot {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      participants: this.getParticipantList(),
      createdAt: this.createdAt,
    };
  }
}
