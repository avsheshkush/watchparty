# 🎓 YouTube Watch Party — Viva & Code Walkthrough Preparation Guide

This guide is designed for technical interviews, evaluations, and viva presentations. It breaks down every critical component, anticipated architectural question, and trade-off with clear, direct explanations.

---

## 📌 1. The Core 10 Viva Questions & Exact Answers

### Q1: Why WebSockets instead of HTTP polling or Server-Sent Events (SSE)?
> **Answer:**
> "HTTP polling introduces unacceptable latency (half of the polling interval on average) and generates heavy HTTP header overhead when polled frequently. Server-Sent Events (SSE) provide server-to-client push, but are strictly unidirectional and run over HTTP/1.1 or HTTP/2 without native bidirectional frame support. 
> WebSockets provide a persistent, full-duplex, bi-directional TCP connection with minimal frame overhead (2–10 bytes). This enables sub-100ms synchronization when a user seeks, pauses, or chats."

### Q2: Why did you choose Socket.IO over raw WebSockets (`ws`)?
> **Answer:**
> "Socket.IO provides critical production abstractions out of the box:
> 1. **Rooms & Namespaces:** Built-in room isolation (`socket.join(roomId)`, `io.to(roomId).emit()`) without having to manually manage socket set dictionaries.
> 2. **Acknowledgement Callbacks:** Request-response semantics over sockets (`socket.emit(event, data, ackCallback)`) allowing clean async/await patterns.
> 3. **Automatic Reconnection & Heartbeats:** Automatic ping/pong health checking and buffered packet reconnection.
> 4. **Horizontal Scaling Path:** Native `@socket.io/redis-adapter` for multi-node clustering without altering application business logic.
> *Trade-off to mention:* Socket.IO adds a custom framing protocol on top of WebSockets, meaning clients must use the Socket.IO client library rather than the browser's bare `WebSocket` API."

### Q3: How does real-time video synchronization actually work?
> **Answer:**
> "We use a **Server-Authoritative Anchor Timestamp Model**. 
> Instead of clients streaming their local playback progress, the server records an anchor position and server timestamp whenever playback changes:
> - When playing: $\text{effectiveTime} = \text{anchorPosition} + (\text{now} - \text{anchorTimestamp}) / 1000$
> - When paused: $\text{effectiveTime} = \text{anchorPosition}$
>
> Every 5 seconds, the server broadcasts a `sync_state` heartbeat. Clients compare their local player time with the expected server position. To prevent audio stutter and constant micro-seeking, the client only adjusts local playback if drift exceeds a **1.5-second deadband threshold**."

### Q4: How do late joiners sync into an active stream?
> **Answer:**
> "When a late joiner connects, the server responds with a comprehensive `room_state` snapshot. This snapshot calculates the current effective position on the fly. The client loads the active YouTube video, seeks directly to that calculated timestamp, and triggers playback if the room state is `playing`."

### Q5: How do you enforce Role-Based Access Control (RBAC)?
> **Answer:**
> "RBAC is enforced strictly on the **server**. While the UI cosmetically disables restricted buttons, the server's `MessageHandler` and `RolePolicy` derive the actor's identity directly from the socket connection (`socket.id -> Participant`). 
> Any client payload attempting to specify their own role or spoof another user is ignored. If an unauthorized participant emits a privileged action (like `play` or `assign_role`), the server rejects it with a `{ ok: false, code: 'FORBIDDEN' }` acknowledgement and never broadcasts changes."

### Q6: How is the Host protected from being hijacked or removed?
> **Answer:**
> "There is an invariant that each room contains **exactly one Host**. 
> The `assign_role` handler explicitly forbids passing `'host'` as a target role. The `remove_participant` handler verifies that the target is not the Host. The only ways host ownership can change are:
> 1. The Host explicitly executes `transfer_host(newHostId)`.
> 2. The Host leaves or stays disconnected for more than 30 seconds, triggering automated **Host Succession** to the earliest Moderator or Participant."

### Q7: How does the Participant Approval Workflow function?
> **Answer:**
> "When a Participant wants to change or pause the video, they emit an `action_request` payload. The server validates this with Zod, limits requests to 3 pending per user, attaches a 60-second TTL, and emits `request_created` **only to the Host and Moderators**. 
> When a privileged user resolves the request with `approve: true`, the server executes the action using the authoritative room methods and broadcasts the updated `sync_state` to all room members."

### Q8: How do you prevent echo loops (ping-pong state cascades)?
> **Answer:**
> "When a remote client receives a `sync_state` broadcast, calling `player.playVideo()` or `player.seekTo()` natively fires YouTube's `onStateChange` event. If unhandled, this event would cause the receiving client to emit a new `play` or `seek` event back to the server, creating an infinite broadcast loop.
> We prevent this using an `isApplyingRemote` boolean flag. Before calling programmatic player methods, we set this flag to `true`, ignore any native events fired during execution, and reset it on the next event loop tick."

### Q9: How do you handle modern browser autoplay restrictions?
> **Answer:**
> "Modern browsers block programmatic audio and video playback unless preceded by a user gesture. 
> To guarantee compliance, we place a transparent click-to-join gate overlay on the player. When the user clicks the player or the 'Join Audio' button, this explicit user gesture unlocks the browser's Web Audio / Media context, initialises the YouTube player, and synchronises it with the server."

### Q10: How does Supabase integrate into the system?
> **Answer:**
> "Supabase provides persistent authentication (Bonus 9C) and cloud PostgreSQL. Users authenticate with Supabase Auth to receive a JWT. During Socket.IO connection initialization, this token is passed in the `auth: { token }` handshake. 
> On the server, `AuthService` verifies the JWT with Supabase's API, ensuring authenticated accounts have verified identities linked to their room sessions."

---

## 📂 2. File-by-File Walkthrough Reference

| File Path | Primary Responsibility | Key Functions / Methods to Highlight |
| :--- | :--- | :--- |
| [`server/src/rooms/Room.ts`](file:///c:/Users/avani/watchparty/server/src/rooms/Room.ts) | Authoritative state container for a single room. Encapsulates business rules with zero socket dependency. | `join()`, `leave()`, `assignRole()`, `removeParticipant()`, `transferHost()`, `handleDisconnection()`, `toSnapshot()` |
| [`server/src/rooms/VideoState.ts`](file:///c:/Users/avani/watchparty/server/src/rooms/VideoState.ts) | Implements anchor mathematical model and versioning for video synchronization. | `getEffectivePosition()`, `play()`, `pause()`, `seek()`, `change()` |
| [`server/src/policy/rolePolicy.ts`](file:///c:/Users/avani/watchparty/server/src/policy/rolePolicy.ts) | Single source of truth for the RBAC permission matrix. | `RolePolicy.can(role, action)`, `PERMISSION_MATRIX` |
| [`server/src/handlers/MessageHandler.ts`](file:///c:/Users/avani/watchparty/server/src/handlers/MessageHandler.ts) | Demultiplexes socket events, runs rate-limiting and zod validation, checks policy, and emits broadcasts. | `register()`, `requireActor()`, `requirePermission()`, `sendAck()` |
| [`client/src/hooks/useYouTubePlayer.ts`](file:///c:/Users/avani/watchparty/client/src/hooks/useYouTubePlayer.ts) | Loads YouTube IFrame API script once, wraps `YT.Player`, manages `isApplyingRemote` echo guard, and handles drift. | `applyState()`, `seekTo()`, `togglePlay()`, `isApplyingRemote` |
| [`client/src/context/RoomContext.tsx`](file:///c:/Users/avani/watchparty/client/src/context/RoomContext.tsx) | React Context managing room state, participants, role changes, and pending request notifications. | `roomReducer()`, `useRoom()` |
| [`server/src/auth/authService.ts`](file:///c:/Users/avani/watchparty/server/src/auth/authService.ts) | Validates Supabase JWTs during Socket.IO handshake and extracts authenticated profiles. | `verifyToken()`, `isConfigured()` |

---

## ⚡ 3. Five Real-World Bugs & How They Were Resolved

1. **Bug: YouTube IFrame Has No Native Seek Event**
   - *Issue:* YouTube's IFrame API does not provide a discrete seek listener; users dragging the native seek bar cannot be cleanly intercepted.
   - *Fix:* Configured the iframe with `controls: 0` and placed a transparent overlay over it. Playback is controlled exclusively via our custom HTML/CSS range slider, where `onChange` and `onMouseUp` emit explicit `seek` events.

2. **Bug: Echo Loop on Remote Playback Broadcasts**
   - *Issue:* When client A paused, the server broadcast `sync_state`. Client B's player paused programmatically, which triggered client B's `onStateChange` listener, emitting another pause event back to the server.
   - *Fix:* Introduced `isApplyingRemote` flag. When the client executes programmatic player commands, the flag is raised and the local listener discards the event.

3. **Bug: Audio Muted or Blocked on Room Join**
   - *Issue:* Chrome blocks unmuted video playback unless triggered by user interaction on that specific origin.
   - *Fix:* Implemented an interactive 'Click to Join / Start Stream' banner and video overlay that requires an initial click, providing the necessary browser gesture token.

4. **Bug: Host Refresh Triggering Accidental Host Reassignment**
   - *Issue:* When a host refreshed the browser (F5), the socket disconnected momentarily, which could immediately trigger host succession.
   - *Fix:* Added a 30-second host succession grace timer. If the host reconnects with their persistent `clientId` within 30 seconds, their Host status is maintained without interruption.

5. **Bug: Memory Leaks from Orphaned Rooms and Heartbeat Timers**
   - *Issue:* Periodic 5-second sync intervals continued running in memory even after all participants left a room.
   - *Fix:* Built an explicit `destroy()` method on the `Room` class that clears all active timers (`heartbeatInterval`, `hostSuccessionTimer`) and added a 10-minute TTL empty room cleanup routine in `RoomManager`.
