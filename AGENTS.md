# AGENTS.md — Rules & Guidelines for YouTube Watch Party

- Read `PROJECT_SPEC.md` and `TASKS.md` before doing anything.
- Work on ONE phase at a time. Do not start the next phase until the current phase's Definition of Done (DoD) is verified.
- Follow the event names, roles, and permission matrix in `PROJECT_SPEC.md` exactly.
- Do not add libraries not listed in the spec without asking.
- Never trust client-supplied identity or role; always derive actor from socket (`socket.id -> Participant`).
- Write/adjust tests for any permission or sync logic in the same phase.
- When done with a phase: run tests + lint, tick completed boxes in `TASKS.md`, and summarise what changed and why.
- Explain non-obvious code briefly in comments and summaries so the developer can explain it in a viva.
