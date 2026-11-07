# Daylight

A private daily planner built with React, Vinext, Cloudflare D1 and Sites authentication. Independent of Sunsama. **This release is a substantial working implementation, not complete Sunsama parity.** See [the current checklist](docs/FEATURE-PARITY.md) for verified, partial, missing and externally blocked behavior.

## Working capabilities

- Multi-day board, daily view, backlog horizons/folders/priorities, search, channels and custom contexts
- Tasks, Markdown notes, timed subtasks, source links, objectives, duplicate/merge/unmerge, archive/trash and undo
- Daily/weekly/monthly/custom recurring series, future occurrences without completion, occurrence navigation, future/all-incomplete edits and stop
- Automatic opening/midnight rollover, collision handling and configurable archive threshold
- Multiple independent timeboxes, timebox editing, calendar pointer move/resize, weekday/channel hours, split scheduling, overflow choices, gaps, pins, reflow and playlist preview
- Selected-day guided planning, shutdown highlights/reflections, weekly planning, multiweek objectives, channel/objective review and export
- Focus stopwatch, Pomodoro intervals and breaks, subtask timing, notes, capture and upcoming meetings in focus, open-app ritual reminders
- Date-based time ledger, saved IANA timezone, DST handling and legacy-time attribution
- Real OpenAI-backed assistant with draft review, validated proposed edits, explicit apply and undo
- Quick capture directives, selected-task keyboard actions, command palette, light/dark/system themes and responsive layouts
- Account-owned cloud persistence, serialized revision checks, local unsaved-draft recovery and online retries
- JSON backup merge and ICS calendar import/export with duplicate prevention
- Direct Google Calendar OAuth, encrypted server tokens, selected-calendar refresh, all-day events and explicit owned-calendar timebox publishing (provider setup and live consent still pending)

Seed records are explicitly labeled samples. Local QA records are not imported from real Sunsama data.

## Limits

Google Calendar integration code is implemented; Google app registration, credentials, consent and live verification are still pending. There are no other live calendar/task-service integrations, email-to-task service, native desktop/mobile clients, global OS shortcuts, floating external focus bar, teammate collaboration or full offline synchronization. The hosted connector eligibility-discovery tool was unavailable; no connections were guessed or simulated. Google refresh polls the selected 42-day window every five minutes while the app is visible; there are no push webhooks, background sync, automatic bidirectional task updates or deletion propagation. Calendar files are one-time copies; recurring ICS rules are not expanded. Recurrence materializes 21 days ahead on load/save. Incomplete-day archive heuristics are simpler than Sunsama. Legacy scalar time totals cannot recover their original dates and are labeled accordingly. Browser notifications require permission and an open app.

## Development

Use Node.js 22.13 or newer. Install with `npm run install:ci`, then build and apply migrations to a fresh local database:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_perfect_rockslide.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_magical_prowler.sql
npm run dev -- --hostname 127.0.0.1
```

The portable preview has a test-only sign-in at `/signin-with-chatgpt?return_to=/`. Production uses Sites-owned authentication and owner-private access. Do not expose the development server publicly.

The AI assistant uses `OPENAI_API_KEY` from an ignored `.env.local` in development and a Sites runtime secret in production. `OPENAI_MODEL` defaults to `gpt-4.1-mini`. Never place either a key or provider credential in source, browser code, the hosting manifest or an archive. Only an explicit user request in the assistant triggers an API call. Planner edits require a separate Apply click; Google publishing is a separate explicit action and never runs through the assistant. Google event titles and identifiers are omitted from AI context; only busy/free time is sent.

## Checks

```sh
npm run typecheck
npm test
npm run build
# With local preview running:
python3 tests/api-smoke.py
```

The checklist records automated and browser verification separately. Browser file-picker automation stalled during ICS upload verification; parser/merge and paste-based preview/import/reimport passed. Hosted sign-in, save/reload and AI response were verified November 7. Release-specific hosted checks are recorded separately from local checks.

## Source

- `app/planner.tsx`: main views and persistence
- `app/planner-features.tsx`, `app/parity-features.tsx`: recurrence, focus, assistant, weekly rituals, import and organization UI
- `lib/planner-model.ts`, `lib/planner-advanced.ts`, `lib/planner-parity.ts`: core operations, lifecycle, scheduling and time ledger
- `lib/calendar-time.ts`, `lib/calendar-import.ts`: timezone conversion and ICS import
- `lib/state-schema.ts`: backward-compatible validation
- `lib/assistant-contract.ts`, `app/api/assistant/route.ts`: validated AI drafts and authenticated server API
- `app/api/planner/route.ts`, `db/`, `drizzle/`: per-account storage with optimistic revisions
- `.openai/hosting.json`: existing Site identity; retain it when deploying

Use the Sites source/build/deploy workflow and preserve the private audience. Credentials, installed dependencies and runtime databases are excluded from packaged source.

## Google Calendar setup

See [Google setup and operational limits](docs/GOOGLE-CALENDAR.md). Provider credentials belong only in ignored local environment files or Sites runtime secrets.
