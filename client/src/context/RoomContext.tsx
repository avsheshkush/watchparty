import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useSocket } from "./SocketContext";
import type { Participant, Role, VideoState, SyncStatePayload, PendingRequest, ToastMessage } from "../types";
import { getClientId, saveUsername } from "../utils/storage";

interface YouData {
  userId: string;
  role: Role;
  username: string;
}

interface RoomContextValue {
  roomId: string | null;
  you: YouData | null;
  participants: Participant[];
  videoState: VideoState | null;
  pendingRequests: PendingRequest[];
  toasts: ToastMessage[];
  kickedReason: string | null;
  createRoom: (username: string) => Promise<string>;
  joinRoom: (roomId: string, username: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
  addToast: (type: ToastMessage["type"], text: string) => void;
  removeToast: (id: string) => void;
  clearKickedReason: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, emitWithAck } = useSocket();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [you, setYou] = useState<YouData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [videoState, setVideoState] = useState<VideoState | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [kickedReason, setKickedReason] = useState<string | null>(null);

  const addToast = useCallback((type: ToastMessage["type"], text: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearKickedReason = useCallback(() => {
    setKickedReason(null);
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Room initial state
    const handleRoomState = (data: {
      roomId: string;
      you: { userId: string; role: Role };
      participants: Participant[];
      videoState?: VideoState;
      pendingRequests?: PendingRequest[];
    }) => {
      setRoomId(data.roomId);
      setParticipants(data.participants || []);
      if (data.videoState) {
        setVideoState(data.videoState);
      }
      if (data.pendingRequests) {
        setPendingRequests(data.pendingRequests);
      }
      setYou((prev) => ({
        userId: data.you.userId,
        role: data.you.role,
        username: prev?.username || "Guest",
      }));
    };

    // User joined
    const handleUserJoined = (data: {
      username: string;
      userId: string;
      role: Role;
      participants: Participant[];
    }) => {
      setParticipants(data.participants);
      addToast("info", `${data.username} joined the party`);
    };

    // User left
    const handleUserLeft = (data: {
      username: string;
      userId: string;
      participants: Participant[];
    }) => {
      setParticipants(data.participants);
      addToast("info", `${data.username} left the room`);
    };

    // Role assigned
    const handleRoleAssigned = (data: {
      userId: string;
      username: string;
      role: Role;
      participants: Participant[];
    }) => {
      setParticipants(data.participants);
      setYou((prev) => {
        if (prev && prev.userId === data.userId) {
          const roleLabel = data.role === "moderator" ? "Moderator" : "Participant";
          addToast("success", `You are now a ${roleLabel}`);
          return { ...prev, role: data.role };
        }
        return prev;
      });
      addToast("info", `${data.username} is now a ${data.role}`);
    };

    // Participant removed
    const handleParticipantRemoved = (data: {
      userId: string;
      participants: Participant[];
    }) => {
      setParticipants(data.participants);
      addToast("warning", "A participant was removed from the room");
    };

    // Current user was kicked
    const handleRemoved = (data: { reason: string }) => {
      setKickedReason(data.reason || "You were removed by the room host");
      setRoomId(null);
      setYou(null);
      setParticipants([]);
      setVideoState(null);
      addToast("error", data.reason || "You were kicked out of the room");
      // Update URL to root
      window.history.pushState({}, "", "/");
    };

    // Host transferred
    const handleHostTransferred = (data: {
      oldHostId: string;
      newHostId: string;
      participants: Participant[];
    }) => {
      setParticipants(data.participants);
      setYou((prev) => {
        if (prev && prev.userId === data.newHostId) {
          addToast("success", "You are now the Room Host!");
          return { ...prev, role: "host" };
        } else if (prev && prev.userId === data.oldHostId) {
          return { ...prev, role: "moderator" };
        }
        return prev;
      });
      addToast("info", "Room Host ownership was transferred");
    };

    // Sync state
    const handleSyncState = (payload: SyncStatePayload) => {
      setVideoState((prev) => {
        if (!prev || payload.version >= prev.version) {
          return {
            videoId: payload.videoId,
            playState: payload.playState,
            position: payload.currentTime,
            currentTime: payload.currentTime,
            updatedAt: payload.serverTime,
            version: payload.version,
          };
        }
        return prev;
      });
    };

    socket.on("room_state", handleRoomState);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("role_assigned", handleRoleAssigned);
    socket.on("participant_removed", handleParticipantRemoved);
    socket.on("removed", handleRemoved);
    socket.on("host_transferred", handleHostTransferred);
    socket.on("sync_state", handleSyncState);

    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("role_assigned", handleRoleAssigned);
      socket.off("participant_removed", handleParticipantRemoved);
      socket.off("removed", handleRemoved);
      socket.off("host_transferred", handleHostTransferred);
      socket.off("sync_state", handleSyncState);
    };
  }, [socket, addToast]);

  const createRoom = async (username: string): Promise<string> => {
    saveUsername(username);
    const clientId = getClientId();

    const data = await emitWithAck<{
      roomId: string;
      userId: string;
      role: Role;
      state: {
        roomId: string;
        participants: Participant[];
        videoState?: VideoState;
      };
    }>("create_room", { username, clientId });

    setRoomId(data.roomId);
    setYou({
      userId: data.userId,
      role: data.role,
      username,
    });
    setParticipants(data.state?.participants || []);
    if (data.state?.videoState) {
      setVideoState(data.state.videoState);
    }

    addToast("success", `Room ${data.roomId} created! You are Host.`);
    return data.roomId;
  };

  const joinRoom = async (targetRoomId: string, username: string): Promise<void> => {
    saveUsername(username);
    const clientId = getClientId();

    const data = await emitWithAck<{
      roomId: string;
      userId: string;
      role: Role;
    }>("join_room", {
      roomId: targetRoomId.toUpperCase().trim(),
      username,
      clientId,
    });

    setRoomId(data.roomId);
    setYou({
      userId: data.userId,
      role: data.role,
      username,
    });
  };

  const leaveRoom = async (): Promise<void> => {
    if (roomId) {
      try {
        await emitWithAck("leave_room", { roomId });
      } catch {
        // Ignore network errors on leave
      }
    }
    setRoomId(null);
    setYou(null);
    setParticipants([]);
    setVideoState(null);
    window.history.pushState({}, "", "/");
  };

  return (
    <RoomContext.Provider
      value={{
        roomId,
        you,
        participants,
        videoState,
        pendingRequests,
        toasts,
        kickedReason,
        createRoom,
        joinRoom,
        leaveRoom,
        addToast,
        removeToast,
        clearKickedReason,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}
