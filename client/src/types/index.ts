export type Role = "host" | "moderator" | "participant";

export interface Participant {
  userId: string;
  username: string;
  role: Role;
  connected: boolean;
}

export interface VideoState {
  videoId: string;
  playState: "playing" | "paused";
  position: number;
  currentTime: number;
  updatedAt: number;
  version: number;
}

export interface SyncStatePayload {
  playState: "playing" | "paused";
  currentTime: number;
  videoId: string;
  version: number;
  serverTime: number;
}

export interface PendingRequest {
  requestId: string;
  fromUserId: string;
  username: string;
  type: "play" | "pause" | "seek" | "change_video";
  payload: {
    time?: number;
    url?: string;
    videoId?: string;
  };
  createdAt: number;
}

export interface ToastMessage {
  id: string;
  type: "info" | "success" | "warning" | "error";
  text: string;
}
