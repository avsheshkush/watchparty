import http from "http";
import path from "path";
import express, { Request, Response } from "express";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";
import { config } from "./config";

function getClientDistPath(): string {
  const candidate1 = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.resolve(process.cwd(), "client/dist");
  if (fs.existsSync(candidate2)) return candidate2;
  const candidate3 = path.resolve(process.cwd(), "../client/dist");
  if (fs.existsSync(candidate3)) return candidate3;
  return candidate1;
}

import { RoomManager } from "./rooms/RoomManager";
import { MessageHandler } from "./handlers/MessageHandler";

const app = express();
const server = http.createServer(app);

// Essential behind reverse proxies like Render
app.set("trust proxy", 1);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled for dev and to allow YouTube iframe embeds & inline scripts
    crossOriginEmbedderPolicy: false,
  })
);

// CORS setup
app.use(
  cors({
    origin: config.nodeEnv === "production" ? true : [config.clientOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);

app.use(express.json());

// REST Health Check Endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    nodeEnv: config.nodeEnv,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// Socket.IO Server configuration
export const io = new SocketIOServer(server, {
  cors: {
    origin: config.nodeEnv === "production" ? true : [config.clientOrigin, "http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

export const roomManager = new RoomManager();
export const messageHandler = new MessageHandler(io, roomManager);

// Socket connection lifecycle & handler registration
io.on("connection", (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Register domain event handlers
  messageHandler.register(socket);

  socket.on("ping", (data: unknown, callback?: (res: unknown) => void) => {
    const response = {
      message: "pong",
      serverTime: Date.now(),
      echo: data,
    };
    if (typeof callback === "function") {
      callback(response);
    } else {
      socket.emit("pong", response);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected (${socket.id}): ${reason}`);
  });
});

// Production: Serve built frontend from client/dist
if (config.nodeEnv === "production") {
  const clientDistPath = getClientDistPath();
  console.log(`[Static] Serving client from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get("*", (req: Request, res: Response) => {
    // Exclude API/Socket routes
    if (req.path.startsWith("/socket.io") || req.path === "/health") {
      return;
    }
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// Start Server
if (process.env.NODE_ENV !== "test") {
  server.listen(config.port, () => {
    console.log(`========================================`);
    console.log(`🚀 WatchParty Server running on port ${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${config.port}/health`);
    console.log(`========================================`);
  });
}

export { app, server };
