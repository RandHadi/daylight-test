# Daylight

A private, original implementation of the daily planning workflow popularized by Sunsama. Built from scratch with React, Vinext, Cloudflare D1, and Sites authentication. It is an independent app, not affiliated with Sunsama.

## Included

- Multi-day board and focused day view
- Task capture, notes, subtasks, priorities, deadlines, channel filtering, archive/restore, and search
- Drag tasks between days, reorder cards, and drop them onto the calendar
- Manual timeboxing, calendar events, overlap layout, and scheduling around existing events
- Guided daily planning, shutdown reflections, weekly objectives, and weekly review
- Focus stopwatch with pause/resume and tracked time
- Daily, weekday, and weekly recurrence: completing a task creates its next occurrence
- Account-owned cloud persistence, serialized saves, optimistic revision checks, save-error recovery, and export
- JSON backup/merge and ICS calendar export
- Responsive layout and keyboard shortcuts

The first workspace contains clearly labeled examples. “Sample tasks · Start fresh” removes the examples; newly created tasks are preserved. Sample records are not imported from a real account.

## Current limits

This is the first working implementation, not complete Sunsama feature parity. External Google/Outlook/Apple calendar sync, task-service integrations, desktop/mobile native apps, background notifications, collaboration, and AI assistance are not implemented. The Integrations dialog explains available exports without pretending to connect. Times use the device's local timezone. ICS export is a one-time copy; changing devices to a different timezone reinterprets the planner's wall-clock times. Weekly tracked totals are grouped by each task's planned day, rather than by a separate session ledger. Focus timing is a stopwatch, not a Pomodoro timer. There is no offline synchronization; save failures remain visible and drafts can be exported before leaving. Concurrent-tab conflicts are rejected rather than silently overwriting newer data.

## Local development

Use Node.js 22.13 or newer. Install dependencies with `npm run install:ci`, then:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_perfect_rockslide.sql
npm run dev -- --hostname 127.0.0.1
```

Apply the migration only once per fresh local database. The portable development server supplies a test-only sign-in at `/signin-with-chatgpt?return_to=/`. Production uses platform-owned authentication and the private Site's access policy. Never expose the development server to a public network.

## Verification

```sh
node --experimental-strip-types --test tests/planner.test.ts
node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions
npm run build
```

The model tests cover date boundaries, recurrence without duplicate generation, collision-free auto-scheduling, workday overflow, timebox replacement, task movement, single-credit focus tracking, and ICS escaping. Local browser checks cover task/subtask creation, reload persistence, time editing, focus pause/completion, recurrence generation, guided planning, and mobile calendar navigation. Local API checks verify unauthenticated access rejection, same-origin writes, payload validation, and stale-revision rejection.

## Source layout

- `app/planner.tsx`: app views and task/event editors
- `app/globals.css`: responsive interface styling
- `lib/planner-model.ts`: planner operations and calendar export
- `lib/state-schema.ts`: data validation
- `app/api/planner/route.ts`: authenticated storage API with revision checks
- `db/schema.ts` and `drizzle/`: database schema and migrations
- `.openai/hosting.json`: Site identity and D1 binding

To deploy changes to the existing Site, preserve the project ID and use the Sites source/build/deploy workflow. The archive excludes installed packages, runtime databases, preview cookies, and Git credentials.
