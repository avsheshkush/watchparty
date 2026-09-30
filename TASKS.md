# TASKS.md — YouTube Watch Party (phase-wise plan)

> Companion to `PROJECT_SPEC.md`. Work **one phase at a time**. Do not start a phase until the previous phase's **Definition of Done (DoD)** passes.
> Tick boxes as you go. Effort estimates are rough for a solo dev using an AI coding agent.

**Phase map**

| # | Phase | Est. |
|---|-------|------|
| 0 | Setup, tooling & deploy-early smoke test | 0.5 d |
| 1 | Backend: rooms & connections | 0.5–1 d |
| 2 | Backend: roles & permission engine | 1 d |
| 3 | Backend: playback sync | 1 d |
| 4 | Frontend: foundation (landing, socket layer, room shell) | 1 d |
| 5 | Frontend: YouTube player & client-side sync | 1–1.5 d |
| 6 | Role management UI & approval workflow | 1 d |
| 7 | Hardening, edge cases & testing | 1 d |
| 8 | Production deployment & verification | 0.5 d |
| 9 | Bonus features | as time allows |
| 10 | Docs, demo & submission readiness | 0.5–1 d |

---

## Phase 0 — Setup, tooling & deploy-early smoke test
**Goal:** repo, tooling and a *proven* public deployment path before writing features.

- [ ] P0-T1 Create Git repo `watchparty` with `.gitignore` (node_modules, .env, dist) and first commit
- [ ] P0-T2 Create monorepo layout: `client/` (Vite + React + TS), `server/` (Node + Express + TS), root `package.json` with scripts (`dev`, `build`, `start`, `test`)
- [ ] P0-T3 Install dependencies — server: `express socket.io zod cors helmet dotenv` (+ dev: `typescript tsx vitest @types/*`); client: `socket.io-client` (+ Tailwind optional)
- [ ] P0-T4 Configure TypeScript (strict), ESLint, Prettier for both packages
- [ ] P0-T5 Add `.env.example` (`PORT`, `NODE_ENV`, `CLIENT_ORIGIN`) and `server/src/config.ts` to parse env
- [ ] P0-T6 Add `AGENTS.md` / agent rules file with project rules (see bottom of this file)
- [ ] P0-T7 Build a **hello-world**: server exposes `/health` and a Socket.IO `ping → pong`; client page has a button that pings and shows the reply
- [ ] P0-T8 Make Express serve `client/dist` in production; confirm `npm run build && npm start` works locally
- [ ] P0-T9 **Deploy the hello-world to Render** (build `npm install && npm run build`, start `npm start`, health check `/health`) and confirm the ping works over `wss://` on the public URL

**DoD:** public URL returns the page; clicking the button gets `pong` from the deployed server.

---

## Phase 1 — Backend: rooms & connections
**Goal:** users can create/join/leave rooms; server tracks participants (no roles logic beyond Host/Participant yet).

- [ ] P1-T1 `utils/roomCode.ts`: generate 6-char code from unambiguous alphabet + collision check
- [ ] P1-T2 `Participant` class (`userId`, `clientId`, `socketId`, `username`, `role`, `connected`)
- [ ] P1-T3 `Room` class: participants map, `join()`, `leave()`, `getParticipantBySocket()`, `toSnapshot()`, `getParticipantList()`
- [ ] P1-T4 `RoomManager` class: `createRoom()`, `getRoom()`, `deleteRoom()`, empty-room cleanup timer (10 min)
- [ ] P1-T5 `validation/schemas.ts`: zod schemas for `create_room`, `join_room`, `leave_room` (username 2–20 chars, roomId format)
- [ ] P1-T6 `MessageHandler` skeleton: registers handlers per socket, standard ack helper `{ ok, code, message }`
- [ ] P1-T7 Handler `create_room` → creator becomes **Host**; socket joins Socket.IO room; ack with `roomId, userId, role, state`
- [ ] P1-T8 Handler `join_room` → Participant by default; send `room_state` to joiner; broadcast `user_joined`; errors `ROOM_NOT_FOUND`, `ROOM_FULL`
- [ ] P1-T9 Handler `leave_room` + Socket.IO `disconnect` handling → broadcast `user_left`
- [ ] P1-T10 Handle `clientId` reuse on reconnect (restore same participant/role — basic version, grace period comes in Phase 7)
- [ ] P1-T11 Unit tests for `Room` (join, leave, snapshot) and `roomCode`

**DoD:** with two `socket.io-client` scripts (or a test), one creates a room, the other joins with the code, both receive correct `participants`, and leaving broadcasts `user_left`.

---

## Phase 2 — Backend: roles & permission engine
**Goal:** the RBAC core — the part reviewers will grill you on.

- [ ] P2-T1 `policy/rolePolicy.ts`: permission map + `RolePolicy.can(role, action)` exactly per the matrix in SPEC §4
- [ ] P2-T2 Reusable guard: `requirePermission(socket, action)` returning actor or throwing a `FORBIDDEN` ack
- [ ] P2-T3 `Room.assignRole(actorId, targetId, role)` — rules: actor is Host, target exists, target ≠ Host, role ∈ {moderator, participant}
- [ ] P2-T4 Handler `assign_role` → broadcast `role_assigned` with fresh `participants`
- [ ] P2-T5 `Room.removeParticipant(actorId, targetId)` — Host only, cannot remove Host/self
- [ ] P2-T6 Handler `remove_participant` → emit `removed` to target, force-leave socket room, broadcast `participant_removed`
- [ ] P2-T7 `Room.transferHost(actorId, targetId)` → old host becomes Moderator; handler broadcasts `host_transferred`
- [ ] P2-T8 zod schemas for the three role events
- [ ] P2-T9 Unit tests: full permission matrix (every role × every action), plus edge cases (assign to self, assign to Host, remove Host, non-host attempts)
- [ ] P2-T10 Integration test: Participant emitting `assign_role`/`remove_participant` gets `FORBIDDEN` and room state is unchanged

**DoD:** test suite proves the matrix; role changes are broadcast; Host can never be lost or duplicated.

---

## Phase 3 — Backend: playback sync
**Goal:** server-authoritative video state and synced broadcasts.

- [ ] P3-T1 `utils/youtubeId.ts`: parse watch/youtu.be/embed/shorts/bare-ID URLs; validate `^[A-Za-z0-9_-]{11}$`; unit tests
- [ ] P3-T2 `VideoState` class: `videoId`, `playState`, `position`, `updatedAt`, `version`; `getEffectivePosition()`, `play()`, `pause()`, `seek()`, `change()`
- [ ] P3-T3 Attach `VideoState` to `Room`; include in `room_state` snapshot (with effective position) so late joiners sync
- [ ] P3-T4 Handlers `play`, `pause`, `seek`, `change_video` — each: zod validate → `RolePolicy` check (Host/Mod) → mutate → broadcast `sync_state { playState, currentTime, videoId, version, serverTime }`
- [ ] P3-T5 Heartbeat: while a room is `playing`, re-broadcast `sync_state` every ~5 s (stop timer when paused/empty)
- [ ] P3-T6 Default video for new rooms (or "no video yet" state + UI prompt)
- [ ] P3-T7 Unit tests: effective-position math (play → wait → pause), seek while playing/paused, change video resets position, invalid time/ID rejected
- [ ] P3-T8 Integration test: Participant `play/pause/seek/change_video` → `FORBIDDEN`, no broadcast; Moderator succeeds and all clients get `sync_state`

**DoD:** with 3 test clients, mod actions reach everyone; participant actions are rejected; a late joiner's snapshot has the correct position.

---

## Phase 4 — Frontend: foundation
**Goal:** UI skeleton connected to the server; no video yet.

- [ ] P4-T1 Router: `/` and `/room/:roomId`; 404 handling
- [ ] P4-T2 `clientId` generation stored in `localStorage`; username persisted for convenience
- [ ] P4-T3 `useSocket` hook / context: single socket instance, connection status, reconnect handling, typed events (share event types via a `shared/` types file or copy)
- [ ] P4-T4 Landing page: **Create room** (username) and **Join room** (username + code) with validation and error display
- [ ] P4-T5 Deep link `/room/ABC123`: if no username, show name gate then auto-join
- [ ] P4-T6 `useRoom` reducer/context handling `room_state`, `user_joined`, `user_left`, `role_assigned`, `participant_removed`, `host_transferred`, `removed`
- [ ] P4-T7 `RoomPage` layout: video area placeholder, participant list, share panel
- [ ] P4-T8 `ParticipantList` with role badges and "You" marker
- [ ] P4-T9 `ShareRoom`: copy code + copy link buttons
- [ ] P4-T10 Toasts for join/leave/kicked/errors; `ConnectionStatus` indicator
- [ ] P4-T11 Handle being removed (redirect to landing with message)

**DoD:** two browser tabs can create/join a room and see each other's names and roles update live.

---

## Phase 5 — Frontend: YouTube player & client-side sync
**Goal:** the actual watch party experience.

- [ ] P5-T1 `useYouTubePlayer` hook: load IFrame API script once, create `YT.Player` with `controls:0`, `disablekb:1`, `modestbranding:1`, `rel:0`
- [ ] P5-T2 Transparent overlay on the iframe so users can't click the native player
- [ ] P5-T3 "Join / Start" click gate (satisfies browser autoplay policy) + "Unmute" fallback
- [ ] P5-T4 `apply(state)` function: load/cue video if `videoId` differs, `seekTo` to expected position, play/pause per `playState`
- [ ] P5-T5 `isApplyingRemote` guard so programmatic changes don't emit events (no echo loops)
- [ ] P5-T6 Custom `PlaybackControls`: play/pause button, seek slider (current time / duration), time labels
- [ ] P5-T7 Emit `play`/`pause`/`seek` from controls **only** for Host/Moderator; controls disabled with tooltip for Participants
- [ ] P5-T8 `VideoUrlForm` (paste YouTube URL) → `change_video` for Host/Mod; show invalid-URL error from ack
- [ ] P5-T9 Drift correction: on each `sync_state`, seek only when `|local − expected| > 1.5 s`; ignore stale `version`
- [ ] P5-T10 Late-join sync: on `room_state`, load video and jump to effective position
- [ ] P5-T11 Player `onError` handling (embedding disabled, invalid ID) with toast
- [ ] P5-T12 Correct-back logic: if a restricted user's local player somehow diverges, re-apply the last server state

**DoD:** Host and Moderator controls sync to all tabs within ~1 s; Participant cannot change anything; a tab joining mid-video lands at the right timestamp.

---

## Phase 6 — Role management UI & approval workflow
**Goal:** finish every Host capability and the participant-request flow.

- [ ] P6-T1 Host menu per participant: **Make Moderator / Make Participant**, **Remove**, **Make Host** (transfer) with confirm dialogs
- [ ] P6-T2 Hide/disable host-only actions for non-hosts; live-update UI on `role_assigned` / `host_transferred` (controls enable/disable instantly)
- [ ] P6-T3 Backend: `PendingRequest` store in `Room` (limit 3 per user, 60 s expiry cleanup)
- [ ] P6-T4 Backend: `action_request` handler (Participant only; validates `type` + payload) → emit `request_created` to Host + Mods only
- [ ] P6-T5 Backend: `resolve_request` handler (Host/Mod) → execute via the same Room methods as privileged actions → broadcast `sync_state`; emit `request_resolved`
- [ ] P6-T6 Backend: clear requests when requester leaves/removed/promoted; handle expired/unknown IDs (`REQUEST_NOT_FOUND`)
- [ ] P6-T7 Frontend `RequestButton` for Participants (request pause/play/seek/change video) with pending-state feedback
- [ ] P6-T8 Frontend `RequestQueue` for Host/Mod with **Approve / Reject**; notification badge
- [ ] P6-T9 Tests: participant request → approve executes and syncs; reject does nothing; participant cannot resolve; expired request rejected

**DoD:** full flow demonstrable in 3 tabs: Participant requests a new video → Host approves → all tabs switch; Host promotes user → user's controls unlock immediately.

---

## Phase 7 — Hardening, edge cases & testing
**Goal:** make it robust enough to demo without fear.

- [ ] P7-T1 Reconnect grace period (30 s): on socket disconnect mark `connected=false`; restore identity/role on reconnect via `clientId`
- [ ] P7-T2 Host succession: if Host is gone > 30 s or leaves → promote earliest Moderator else earliest Participant; broadcast `host_transferred`
- [ ] P7-T3 Empty-room cleanup and heartbeat timer cleanup (no leaked intervals)
- [ ] P7-T4 Per-socket rate limiter (events/sec; stricter for chat) → `RATE_LIMITED`
- [ ] P7-T5 Global error boundary on handlers: no unhandled exception can crash the process
- [ ] P7-T6 Removed-user blocklist by `clientId` for the room's lifetime (nice-to-have)
- [ ] P7-T7 Duplicate-username handling; username/chat sanitization and length limits
- [ ] P7-T8 Security pass: `helmet`, CORS restricted, no `dangerouslySetInnerHTML`, zod `.strict()` schemas
- [ ] P7-T9 Manual QA script — 3 browsers (one on phone if possible): create/join, sync, seek spam, refresh mid-video, host leaves, kick, approval flow, bad URLs, invalid room code
- [ ] P7-T10 Run `vitest` in CI-style (`npm test`) and fix flaky tests; add `npm run lint`

**DoD:** the manual QA checklist passes with no crashes; tests green.

---

## Phase 8 — Production deployment & verification
**Goal:** the deployed app behaves like local.

- [ ] P8-T1 Final Render config (build/start commands, `NODE_ENV=production`, health check, env vars from SPEC §14); `trust proxy` set
- [ ] P8-T2 Deploy latest `main`; confirm build logs clean
- [ ] P8-T3 Production smoke test on the **public URL** across two different devices/networks: create → join → play/pause/seek/change video → promote → remove → approval flow
- [ ] P8-T4 Check browser console/network for WebSocket upgrade (`wss://`), mixed-content, CORS errors
- [ ] P8-T5 Handle free-tier sleep: note cold start in README; optionally set up an uptime ping (e.g., UptimeRobot on `/health`)
- [ ] P8-T6 Confirm restart behavior is acceptable (in-memory rooms reset on redeploy — documented trade-off, or fixed via persistence bonus)
- [ ] P8-T7 Put the live URL into README (placeholder → real)

**DoD:** everything in SPEC §1 "MVP success criteria" works on the public URL.

---

## Phase 9 — Bonus features (only after Phase 8 passes)
Do in order; each is independent.

**9A. Chat & reactions**
- [ ] P9-T1 `chat_message` handler with 300-char limit + rate limit; `Chat` panel with auto-scroll
- [ ] P9-T2 `reaction` handler with emoji allow-list; floating reaction animation

**9B. Persistent rooms**
- [ ] P9-T3 Add MongoDB (Mongoose) or SQLite; `rooms` schema `{ roomId, hostClientId, currentVideoId, lastPosition, createdAt, lastActiveAt }`
- [ ] P9-T4 Save on create / periodic / video change; lazily restore room when a known code is joined after restart
- [ ] P9-T5 Add `MONGODB_URI` env var on Render; document in README

**9C. Authentication**
- [ ] P9-T6 Login/signup (or Google OAuth); issue JWT; pass in Socket.IO `auth` handshake; reject unauthenticated sockets
- [ ] P9-T7 Use account ID as stable identity instead of `clientId`

**9D. Scalability**
- [ ] P9-T8 Add `@socket.io/redis-adapter` + Redis; force `transports: ["websocket"]` (or sticky sessions) for multi-instance
- [ ] P9-T9 Move room state (or at least video state/participants) to Redis so any instance can serve any room
- [ ] P9-T10 Load-test with `artillery`/k6 (target 1000+ users, 100+ rooms, 50+ per room); record results in `docs/SCALING.md`

---

## Phase 10 — Docs, demo & submission readiness
**Goal:** everything the reviewer asked for, ready to hand in.

- [ ] P10-T1 `README.md`: overview, **live URL**, features, tech stack, roles matrix, local setup (`git clone`, `npm install`, `.env`, `npm run dev`), env vars, deployment steps, trade-offs & known limitations
- [ ] P10-T2 Architecture overview: Mermaid diagram + "how WebSockets fit the flow" (copy from SPEC §6–7) in README or `docs/ARCHITECTURE.md`
- [ ] P10-T3 Event reference table in README (from SPEC §8)
- [ ] P10-T4 Record a 2–3 min demo video or capture screenshots (create → join → sync → roles → kick → approval)
- [ ] P10-T5 Code walkthrough prep: rehearse the SPEC §16 checklist aloud; open each key file (`Room.ts`, `RolePolicy.ts`, `MessageHandler.ts`, `useYouTubePlayer.ts`) and explain it without notes
- [ ] P10-T6 Prepare a list of "issues I ran into & how I fixed them" (autoplay policy, seek detection, echo loops, host succession, Render sleep)
- [ ] P10-T7 Repo hygiene: remove dead code/console logs, no secrets committed, meaningful commit history, `.env.example` present
- [ ] P10-T8 Final check: fresh clone → install → run works from README steps alone; live URL opens and works
- [ ] P10-T9 Submit: repo link + live URL (+ demo link)

**DoD:** a stranger can clone, run, and understand the project from the README; you can explain every file.

---

## Cross-cutting rules (apply in every phase)

- **Server authority:** UI restrictions are cosmetic; the backend always re-checks permissions.
- **Validate everything:** zod on every incoming event.
- **Small commits:** one task or small group per commit (`feat:`, `fix:`, `test:`, `docs:`).
- **Test as you go:** any permission or sync logic gets a unit test in the same phase.
- **Understand before moving on:** you must be able to explain each piece (the assignment explicitly tests this).

---

## Using an AI coding agent effectively

**Rules file (`AGENTS.md` or your tool's rules/instructions file):**
```
- Read PROJECT_SPEC.md and TASKS.md before doing anything.
- Work on ONE phase at a time. Do not start the next phase.
- Follow the event names, roles and permission matrix in PROJECT_SPEC.md exactly.
- Do not add libraries not listed in the spec without asking.
- Never trust client-supplied identity/role; always derive from the socket.
- Write/adjust tests for any permission or sync logic.
- When done: run tests + lint, tick completed boxes in TASKS.md, and summarise what changed and why.
- Explain non-obvious code briefly in comments/summary (the developer must be able to explain it in a viva).
```

**Prompt template per phase:**
> "Read PROJECT_SPEC.md and TASKS.md. Implement **Phase N** only, task by task. After each task, run the relevant tests. At the end, tick the boxes, list files changed, and explain the key logic in plain language."

**Review habit:** after each phase, read the diff yourself, run the app in 2–3 tabs, and try to break permissions by emitting forbidden events from the browser console.
