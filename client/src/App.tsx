import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

interface PongResponse {
  message: string;
  serverTime: number;
  echo: unknown;
}

interface PingLogItem {
  id: string;
  sentAt: number;
  receivedAt: number;
  latencyMs: number;
  serverTime: number;
}

// In production, connect to same host; in dev connect to Vite proxy or localhost:3000
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.PROD ? window.location.origin : "http://localhost:3000");

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string>("");
  const [logs, setLogs] = useState<PingLogItem[]>([]);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [healthData, setHealthData] = useState<{ status: string; uptime: number; nodeEnv: string } | null>(null);

  useEffect(() => {
    const s: Socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    s.on("connect", () => {
      setIsConnected(true);
      setSocketId(s.id || "");
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      setSocketId("");
    });

    setSocket(s);

    // Initial health check fetch
    fetch(`${SERVER_URL}/health`)
      .then((res) => res.json())
      .then((data) => setHealthData(data))
      .catch(() => {});

    return () => {
      s.disconnect();
    };
  }, []);

  const handlePing = () => {
    if (!socket || !isConnected) return;
    setIsPinging(true);
    const sentAt = Date.now();

    socket.emit("ping", { clientTimestamp: sentAt }, (res: PongResponse) => {
      const receivedAt = Date.now();
      const latencyMs = receivedAt - sentAt;
      setLogs((prev) => [
        {
          id: `${sentAt}-${Math.random()}`,
          sentAt,
          receivedAt,
          latencyMs,
          serverTime: res.serverTime,
        },
        ...prev.slice(0, 9), // keep last 10
      ]);
      setIsPinging(false);
    });
  };

  const handleRefreshHealth = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/health`);
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      console.error("Health check error", err);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="ambient-glow" />

      <main style={{ maxWidth: "800px", margin: "3rem auto", padding: "0 1.5rem", width: "100%" }}>
        {/* Header */}
        <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "2rem" }}>🎬</span>
            <h1
              style={{
                fontSize: "2.25rem",
                fontWeight: 800,
                background: "var(--accent-gradient)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              WatchParty
            </h1>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>
            Real-Time Synchronized YouTube Streaming System
          </p>
          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.75rem" }}>
            <span className={`status-pill ${isConnected ? "status-online" : "status-offline"}`}>
              <span className="status-dot" />
              {isConnected ? "WebSocket Connected" : "Connecting to Server..."}
            </span>
            {socketId && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.75rem",
                  background: "var(--bg-glass)",
                  padding: "0.25rem 0.6rem",
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-dim)",
                }}
              >
                ID: {socketId}
              </span>
            )}
          </div>
        </header>

        {/* Phase 0 Smoke Test Panel */}
        <div className="glass-panel" style={{ padding: "2rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Phase 0 Smoke Test</h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                Testing full-duplex WebSocket connection and ack latency
              </p>
            </div>
            <button
              id="ping-button"
              className="btn-primary"
              onClick={handlePing}
              disabled={!isConnected || isPinging}
            >
              {isPinging ? "Pinging..." : "⚡ Send Ping"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                background: "var(--bg-glass)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Server Target</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", marginTop: "0.25rem", wordBreak: "break-all" }}>
                {SERVER_URL}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-glass)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Uptime / Env</div>
              <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                {healthData ? `${healthData.uptime.toFixed(1)}s (${healthData.nodeEnv})` : "Loading..."}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-glass)",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>Latest Latency</div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  marginTop: "0.25rem",
                  color: logs.length > 0 ? (logs[0].latencyMs < 50 ? "#34d399" : "#fbbf24") : "var(--text-dim)",
                }}
              >
                {logs.length > 0 ? `${logs[0].latencyMs} ms` : "—"}
              </div>
            </div>
          </div>

          {/* Ping Logs */}
          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-muted)" }}>
                Latency History (Ack callbacks)
              </span>
              <button
                className="btn-secondary"
                onClick={handleRefreshHealth}
                style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
              >
                Re-check /health
              </button>
            </div>

            {logs.length === 0 ? (
              <div
                style={{
                  padding: "1.5rem",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                }}
              >
                Click "Send Ping" above to test the WebSocket round-trip!
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.6rem 1rem",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(0,0,0,0.25)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8rem",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <span>
                      Client <span style={{ color: "var(--accent-primary)" }}>PING</span> ➔ Server <span style={{ color: "var(--status-success)" }}>PONG</span>
                    </span>
                    <span style={{ color: log.latencyMs < 50 ? "#34d399" : "#fbbf24", fontWeight: 600 }}>
                      {log.latencyMs}ms
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
