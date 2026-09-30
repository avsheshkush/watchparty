import React, { useState, useEffect } from "react";
import { SocketProvider } from "./context/SocketContext";
import { RoomProvider, useRoom } from "./context/RoomContext";
import { LandingPage } from "./components/LandingPage";
import { RoomPage } from "./components/RoomPage";
import { ToastContainer } from "./components/ToastContainer";

// Helper to extract room code from URL: /room/:roomId
function getRoomCodeFromPath(): string {
  const match = window.location.pathname.match(/\/room\/([A-Za-z0-9_-]+)/i);
  return match ? match[1].toUpperCase() : "";
}

const MainApp: React.FC = () => {
  const { roomId } = useRoom();
  const [initialRoomCode, setInitialRoomCode] = useState<string>(() => getRoomCodeFromPath());

  useEffect(() => {
    const handlePopState = () => {
      setInitialRoomCode(getRoomCodeFromPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="app-wrapper">
      <div className="ambient-glow" />
      <ToastContainer />

      {roomId ? (
        <RoomPage />
      ) : (
        <LandingPage
          initialRoomCode={initialRoomCode}
          onRoomJoined={() => {
            setInitialRoomCode("");
          }}
        />
      )}
    </div>
  );
};

export function App() {
  return (
    <SocketProvider>
      <RoomProvider>
        <MainApp />
      </RoomProvider>
    </SocketProvider>
  );
}

export default App;
