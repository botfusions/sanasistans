PROMPT 1 — Setup Plan (anti-gravity / Claude Code)
You are my setup engineer.
Goal: Create a local Telegram-based assistant bot called "Agent Claw".
Requirements:

- Telegram Bot API token via environment variable TELEGRAM_BOT_TOKEN.
- Model provider key via environment variable MODEL_API_KEY.
- Allowlist only my Telegram user id via TELEGRAM_ALLOWLIST_USER_ID.
- Start with text chat only (we will add voice later).
- Keep secrets out of logs. Never print keys.
  Deliverables:

1. Minimal folder structure for the project
2. A config/env template file (no real keys)
3. Instructions to run locally
4. A quick self-test checklist (how to confirm the bot is alive)
   Before writing anything, ask me what OS I’m on and whether I want Docker or bare-metal install.
   ⸻
   PROMPT 2 — Add Voice Transcription (anti-gravity / Claude Code)
   Upgrade Agent Claw to support Telegram voice messages.
   Behavior:

- If user sends a voice message, download it, transcribe it to text, then respond normally.
- Always send the transcription back to the user first, then the assistant reply.
- If transcription fails, respond with a friendly error and ask the user to retry.
  Engineering requirements:
- Add env var TRANSCRIPTION_API_KEY (do not log it).
- Keep code modular: /src/transcription, /src/telegram, /src/handlers.
- Add a small test or a local “mock transcription” mode.
  Deliverables:
- Update README with setup steps and troubleshooting.
- Add a startup log that confirms voice is enabled without revealing secrets.
  ⸻
  PROMPT 3 — Optional TTS Replies (anti-gravity / Claude Code)
  Add optional text-to-speech replies.
  Rules:
- Only send a voice reply when the user explicitly says: "reply with voice".
- Use env var TTS_API_KEY.
- Do not store generated audio permanently; clean up temp files.
- Keep default behavior text-only.
  Update README with how to enable and use it.
  ⸻
  PROMPT 4 — Add Memory Layer (anti-gravity / Claude Code)
  Implement long-term memory for Agent Claw.
  Goals:
- Store key user facts and conversation snippets as embeddings in a vector database.
- Retrieve only relevant memories per request (top-k) to keep context small.
- Maintain a small "core memory" file for stable preferences.
  Requirements:
- Add env vars VECTOR_DB_API_KEY and VECTOR_DB_INDEX (placeholders only).
- Create /memory/core_memory.md (editable by me).
- Create /memory/memory_log.md (append-only, safe summaries).
- Add a command: "/remember" to store a user message explicitly.
- Add a command: "/recall <query>" to fetch relevant memories.
  Deliverables:
- Update README with setup + privacy notes.
- Add a simple test script that verifies memory write/read without real API calls (mock mode).
  ⸻
  PROMPT 5 — Create Assistant Personality Guide (anti-gravity / Claude Code)
  Create a "soul.md" file that defines Agent Claw’s communication style.
  Constraints:
- Friendly expert tone, concise, not robotic.
- No excessive flattery.
- If uncertain, state assumptions clearly.
- Always propose next steps.
- Never expose secrets. Never ask for passwords.
  Also add "Do / Don't" examples.
  Save to: /memory/soul.md
  ⸻
  PROMPT 6 — MCP Wiring Plan (anti-gravity / Claude Code)
  I want to connect Agent Claw to external tools via MCP.
  First:
- List the safest MCP integration pattern (principle of least privilege).
- Provide a checklist for connecting ONE tool (email or calendar) end-to-end.
- Include guardrails: never send sensitive fields to third parties, redact logs, allowlist commands.
  Then:
- Ask me which tool I want first: Gmail, Google Calendar, Notion, or Google Drive.
- After I answer, generate the exact config steps and a test prompt I can run in Telegram.
  ⸻
  PROMPT 7 — Read-only Calendar Summary Test (anti-gravity / Claude Code)
  In Telegram, I will ask: "What's on my calendar tomorrow?"
  Implement a read-only flow:
- Fetch tomorrow's events
- Return a short summary (max 5 bullets)
- If no events, say "No events scheduled."
  Do not create, edit, or delete events.
  Log only non-sensitive metadata.
  ⸻
  PROMPT 8 — Daily Heartbeat (anti-gravity / Claude Code)
  Add a daily "heartbeat" message system.
  Behavior:
- Every day at 08:00 (local time), send me a Telegram message:

1. "What is your #1 priority today?"
2. "Any blocker I should help remove?"

- Keep it short.
- Add a kill switch env var: HEARTBEAT_ENABLED=true/false
  Engineering:
- Use a scheduler (cron) appropriate for the environment.
- Ensure only allowlisted user receives it.
- Add logs that confirm it ran, without sensitive content.
  Deliverables:
- Update README
- Add a manual test command: "/heartbeat_test" that triggers one message immediately.
  ⸻
  PROMPT 9 — Deploy to Managed Runtime (anti-gravity / Claude Code)
  I want to run Agent Claw remotely so it works 24/7.
  Create a deployment plan for a managed runtime (e.g., Railway):
- Environment variables setup (no secrets in code)
- Start command
- Health check
- Log hygiene
- Recommended minimal permissions
  Then generate:

1. A deployment-ready configuration file if needed
2. A step-by-step checklist I can follow
3. A rollback plan
