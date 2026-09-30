export type Role = "host" | "moderator" | "participant";

export interface ParticipantSnapshot {
  userId: string;
  username: string;
  role: Role;
  connected: boolean;
}

export class Participant {
  public readonly userId: string;
  public readonly clientId: string;
  public socketId: string;
  public username: string;
  public role: Role;
  public connected: boolean;
  public readonly joinedAt: number;
  public disconnectedAt: number | null;

  constructor(params: {
    userId: string;
    clientId: string;
    socketId: string;
    username: string;
    role?: Role;
  }) {
    this.userId = params.userId;
    this.clientId = params.clientId;
    this.socketId = params.socketId;
    this.username = params.username;
    this.role = params.role || "participant";
    this.connected = true;
    this.joinedAt = Date.now();
    this.disconnectedAt = null;
  }

  /**
   * Updates the socketId on client reconnect.
   */
  public reconnect(socketId: string): void {
    this.socketId = socketId;
    this.connected = true;
    this.disconnectedAt = null;
  }

  /**
   * Marks participant as disconnected while keeping role for grace period.
   */
  public disconnect(): void {
    this.connected = false;
    this.disconnectedAt = Date.now();
  }

  /**
   * Returns a sanitized snapshot suitable for broadcasting to clients.
   */
  public toSnapshot(): ParticipantSnapshot {
    return {
      userId: this.userId,
      username: this.username,
      role: this.role,
      connected: this.connected,
    };
  }
}
