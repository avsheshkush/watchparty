import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface AckResponse<T = unknown> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  socketId: string;
  authError: string | null;
  emitWithAck: <T = unknown>(event: string, payload: unknown) => Promise<T>;
  getServerNow: () => number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:3000");

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const clockOffsetRef = useRef<number>(0);

  useEffect(() => {
    // Only connect if user is authenticated with a valid token
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setSocketId("");
      return;
    }

    setAuthError(null);

    const s: Socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;

    s.on("connect", () => {
      setIsConnected(true);
      setAuthError(null);
      setSocketId(s.id || "");

      // Calibrate client-server clock offset
      const t0 = Date.now();
      s.emit("ping", {}, (res: any) => {
        const t1 = Date.now();
        if (res && typeof res.serverTime === "number") {
          const rtt = Math.max(0, t1 - t0);
          const estimatedServerTime = res.serverTime + rtt / 2;
          clockOffsetRef.current = estimatedServerTime - t1;
        }
      });
    });

    s.on("connect_error", (err: Error) => {
      console.warn("[Socket] Connection error:", err.message);
      if (err.message.includes("UNAUTHORIZED")) {
        setAuthError(err.message);
      }
      setIsConnected(false);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setSocketId("");
    });

    setSocket(s);

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const getServerNow = useCallback(() => {
    return Date.now() + clockOffsetRef.current;
  }, []);

  const emitWithAck = <T = unknown,>(event: string, payload: unknown): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      if (!socketRef.current) {
        return reject(new Error("Socket not connected. Please ensure you are logged in."));
      }

      socketRef.current.emit(event, payload, (res: AckResponse<T>) => {
        if (!res) {
          return reject(new Error("No acknowledgement received from server"));
        }
        if (res.ok && res.data !== undefined) {
          resolve(res.data);
        } else if (res.ok) {
          resolve({} as T);
        } else {
          const err = new Error(res.message || res.code || "Operation failed");
          (err as unknown as { code: string }).code = res.code || "UNKNOWN";
          reject(err);
        }
      });
    });
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketId, authError, emitWithAck, getServerNow }}>
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
