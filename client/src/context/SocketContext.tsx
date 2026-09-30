import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

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
  emitWithAck: <T = unknown>(event: string, payload: unknown) => Promise<T>;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:3000");

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s: Socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;

    s.on("connect", () => {
      setIsConnected(true);
      setSocketId(s.id || "");
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setSocketId("");
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  const emitWithAck = <T = unknown,>(event: string, payload: unknown): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      if (!socketRef.current) {
        return reject(new Error("Socket not connected"));
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
    <SocketContext.Provider value={{ socket, isConnected, socketId, emitWithAck }}>
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
