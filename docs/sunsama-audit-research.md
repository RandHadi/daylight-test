# Sunsama parity research — baseline audit

Researched 2026-11-01 from Sunsama's live help catalog and complete official help articles. Source comparison is against Daylight commit `2bf8894fd7950f22738acba893e4212f8671ff3d`, before the current improvement pass. This document is a research baseline, not a statement that later implementation has passed acceptance tests. No user Sunsama account records were inspected.

**Finding:** Daylight has a useful core workflow, but is not feature-complete or behaviorally identical. Matching a feature label does not demonstrate parity. “Verified” should be reserved for a documented acceptance case that passed against the actual final app. The statuses below are source-inspection statuses only: **Partial** means an implementation exists but misses documented behavior; **Missing** means no implementation was found. Beta features are marked separately.

## Code evidence

- `lib/planner-model.ts`: task has one planned date, scalar `actual`, three priority levels, four recurrence choices. `completeTask` produces the next occurrence only on completion. `scheduleTask` removes every previous block for that task. `autoSchedule` finds one contiguous gap from a single daily start/end window. No task series, daily time ledger, priority history, bucket, folder, or recurrence template exists.
- `lib/state-schema.ts`: validates the same version-1 model. Model changes require migration/defaulting so saved accounts and backups remain readable.
- `app/planner.tsx`: manual planning and shutdown; minimal weekly chart; one in-app focus stopwatch; simple search; keyboard shortcuts have no hovered-task dispatch or command palette. Backlog is a flat unscheduled task list. Archive is manual. Weekly planning is absent. UI refreshes `today` but does not process rollover.
- `README.md`: explicitly excludes integrations, native clients, notifications, collaboration, and AI. Calendar times follow device timezone; no offline synchronization; weekly totals use task planned date.

## Task lifecycle and recurrence

| ID | Capability / baseline | Behavioral acceptance criteria | Official evidence |
|---|---|---|---|
| T01 | Task details — Partial | Create/edit title, rich notes, subtasks, channel, dates, times; inspect after reload. Preserve rich note formatting rather than just plain textarea text. | [Creating tasks](https://help.sunsama.com/docs/usage-guides/tasks/creating-tasks) |
| T02 | Rich capture — Partial | Add-task directives select date, estimate, channel, objective, and appropriate priority. Enter saves; modifier+Enter saves and opens. Explicit top/bottom overrides work. | [Creating tasks](https://help.sunsama.com/docs/usage-guides/tasks/creating-tasks) |
| T03 | Recurrence generation — Partial | Future occurrences exist without completing the preceding task. Support daily, weekdays, selected weekdays, and regular monthly work; preserve a series identity and template. Generating/reloading repeatedly never duplicates an occurrence. Monthly edge behavior needs an explicit tested policy; docs do not fully specify it. | [Recurring tasks](https://help.sunsama.com/docs/usage-guides/tasks/recurring-tasks) |
| T04 | Series operations — Missing | Navigate previous/next; change frequency or approximate time; stop future occurrences while keeping current/past; delete incomplete instances while preserving completed history; propagate template edits to incomplete occurrences. | [Recurring tasks](https://help.sunsama.com/docs/usage-guides/tasks/recurring-tasks) |
| T05 | Approximate recurring time — Missing | A preferred time influences ordering and auto-scheduling without creating a fixed appointment. An occupied preference uses a nearby feasible future slot. | [Recurring tasks](https://help.sunsama.com/docs/usage-guides/tasks/recurring-tasks) |
| T06 | Midnight rollover — Missing | Incomplete scheduled tasks advance automatically at date change, including after the app was closed. Processing the same day twice is idempotent. Completed tasks and backlog stay put; rollover count/history remain available. | [Rollover](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics) |
| T07 | Recurrence collisions — Missing | An unmodified older instance colliding with the next occurrence is suppressed. Preserve older instances changed in title, notes, subtasks, channel, estimate, or actual time. Never discard meaningful work. | [Rollover](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics) |
| T08 | Automatic archive — Missing | Configurable consecutive-incomplete-day threshold, disable option, count badge, callout, and restore/backlog/complete/delete triage. Docs describe auto-archive rather than manually archiving arbitrary tasks. Inactivity threshold must account for task work. | [Archive](https://help.sunsama.com/docs/usage-guides/archive) |
| T09 | Delete and recovery — Partial | Delete task and related sessions with undo, later recover via Trash. Restore preserves notes, times, recurrence identity and source links. Manual Archive is not a substitute for Trash. | [FAQ](https://help.sunsama.com/docs/faq/faq) |
| T10 | Merge / unmerge — Missing | Merge a task into another as subtask and preserve notes, estimate and integration metadata; convert back. Imported event tasks cannot merge in either direction. | [Merge tasks](https://help.sunsama.com/docs/usage-guides/tasks/merge-tasks) |
| T11 | Link capture — Missing | Generic URL becomes a source backlink. Connected integration URLs resolve item metadata with preview; disconnected service asks to connect. Generic link support alone is partial. | [Add via URL](https://help.sunsama.com/docs/usage-guides/tasks/add-via-url) |

## Backlog, priority, sorting, and organization

| ID | Capability / baseline | Behavioral acceptance criteria | Official evidence |
|---|---|---|---|
| B01 | Backlog buckets — Missing | Support Next week or two, Next month, Next quarter, Next year, Someday, Never; buckets do not imply exact dates. Filter and move between buckets without losing content. | [Backlog](https://help.sunsama.com/docs/usage-guides/backlog) |
| B02 | Backlog folders — Missing | Create/manage/filter folders. Scheduling a task clears backlog folder assignment as documented. Scheduling and returning to backlog must have an explicit predictable policy. | [Backlog](https://help.sunsama.com/docs/usage-guides/backlog) |
| B03 | Two priority systems — Partial | Daily: Urgent, Priority, Normal, Low Priority. Backlog: Urgent, High, Medium, Low, No priority. Daily priority resets at rollover unless its level is configured to persist; backlog priority persists. Filter backlog by level. | [Task priority](https://help.sunsama.com/docs/usage-guides/tasks/task-priority) |
| B04 | Automatic task order — Missing | Creation/priority changes place task by priority; estimate/unscheduling changes settle chronological position without indiscriminate priority reorder. Fixed times, deliberate manual ordering, and running timer are honored. Turning off auto-sort respects new-task top/bottom preference. | [Auto-sort](https://help.sunsama.com/docs/usage-guides/tasks/auto-sort) |
| B05 | Channels/contexts — Partial | Create/edit/disable channels and contexts, designate personal contexts, set default channel, and inherit active channel when capturing. Existing model fixes contexts to Work/Personal and only adds channels. | [Channels and contexts](https://help.sunsama.com/docs/usage-guides/channels-and-contexts) |
| B06 | Workload calculation — Partial | Personal-context tasks do not contribute to work capacity warnings. Filtered totals reflect current scope. Show total remaining, work remaining, and actual/planned views. Capacity can differ by weekday. | [Times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times), [Settings](https://help.sunsama.com/docs/settings/user-settings) |
| B07 | Search and navigation — Partial | Search archived/completed tasks and notes; filter by channel, type, date. Show all matching results or paginate, not only first 30. Kanban, Today and backlog each retain useful navigation. | [FAQ](https://help.sunsama.com/docs/faq/faq) |

## Calendar, scheduling and time accounting

| ID | Capability / baseline | Behavioral acceptance criteria | Official evidence |
|---|---|---|---|
| C01 | Manual timeboxing — Partial | Drag task to calendar, move/resize a working session, remove session without deleting task. Moving task to another day unschedules its old session; moving session moves associated task view. Verify pointer and keyboard paths, not just event handlers. | [Timebox how-to](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-how-to-timebox) |
| C02 | Multiple sessions — Missing | One task can have multiple working sessions on one day and across days. Adding another session cannot replace all prior sessions. Daily views show that day's values; full task shows cumulative history. | [Timebox how-to](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-how-to-timebox) |
| C03 | Auto-schedule — Partial | Respect weekday/channel schedules, visible busy events, preferred recurring times and gap setting. Ignore declined/free events. Split long work into usable intervals; allow no-split modifier. On overflow offer schedule anyway, another day, or defer. Avoid past slots today. | [Auto-scheduling](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-auto-scheduling) |
| C04 | Conflict rescheduling — Missing | When a task conflicts, shift only eligible working sessions around immovable events. Overflow unschedules task but retains it. Modifier disables behavior. Undo restores only automatic adjustments while preserving the initiating edit. | [Auto-rescheduling](https://help.sunsama.com/docs/usage-guides/timeboxing/auto-rescheduling) |
| C05 | Early-completion rescheduling — Missing | Truncate early-completed session and advance only contiguous following task sessions. Leave separated work groups and calendar meetings intact. Independent enable setting from conflict handling. | [Auto-rescheduling](https://help.sunsama.com/docs/usage-guides/timeboxing/auto-rescheduling) |
| C06 | Playlist projections — Missing | Deterministic preview from task order, remaining estimate, busy events and work hours. Timer progress, pause and reordering recompute it. Projection does not create external events; pinned sessions stay fixed. | [Playlist method](https://help.sunsama.com/docs/usage-guides/playlisting) |
| C07 | Daily time ledger — Missing | Log planned/actual per task and date/session; cumulative card differs appropriately from day totals. Incomplete task with logged time remains visible in prior-day history. Splitting sessions/rollover cannot relocate historical tracked time. | [Times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times), [FAQ](https://help.sunsama.com/docs/faq/faq) |
| C08 | Subtask timing — Missing | Subtasks have planned/actual time and can run the task timer. Parent totals avoid double-counting subtask time. Manual actual-time edits and optional planned-as-actual fallback work predictably. | [Times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times) |
| C09 | Calendar routing/settings — Missing | Per-channel/default destination calendars; busy/free, private/public and reminder controls. Personal/private channels force private events. Visible calendars influence availability. | [Timeboxing settings](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-customizing-settings) |
| C10 | Calendar integrations — Missing | Google, Microsoft, Apple/iCloud and CalDAV accounts show real events and timeboxed writes; external changes synchronize; reconnect/errors are explicit. ICS export alone does not pass. | [Calendar integration](https://help.sunsama.com/docs/integrations/calendar) |
| C11 | Meeting import — Missing | Manual and automatic event-to-task import with event-type filters and configurable completion. Keep external event versus task deletion semantics distinct. | [Importing meetings](https://help.sunsama.com/docs/usage-guides/importing-meetings), [Timebox how-to](https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-how-to-timebox) |
| C12 | Timezone/time format — Partial | Account timezone persists across devices; alert on device timezone changes; explicit 12/24/system format. Test DST transitions and travel without shifting history. Current device-local wall-clock model is insufficient. | [Settings](https://help.sunsama.com/docs/settings/user-settings) |

## Daily and weekly rituals

| ID | Capability / baseline | Behavioral acceptance criteria | Official evidence |
|---|---|---|---|
| R01 | Manual daily planning — Partial | Review yesterday if needed; capture from backlog/objectives/integrations; work-only capacity prediction; arrange/timebox; finalize/share. Any selected future day can be planned. Adding/editing a task returns to the active ritual. | [Legacy daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning/legacy) |
| R02 | Ritual automation — Missing | Configurable daily/weekly prompt times; planning after 3 PM targets next day; coincident shutdown/planning runs shutdown first. Prompts can be disabled. Historical ritual records remain reviewable. | [Legacy daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning/legacy), [Settings](https://help.sunsama.com/docs/settings/user-settings) |
| R03 | Shutdown / highlights — Partial | Review actual work/time, curate highlights, reorder/nest/star items, save reflection with optional prompt/emoji, and maintain a dated journal. AI summaries and email/Slack/Teams delivery remain separate integration requirements. | [Daily highlights](https://help.sunsama.com/docs/usage-guides/daily-highlights) |
| R04 | Weekly objectives — Partial | Align tasks, make task from objective, convert task into objective, channel inheritance, planned/actual per-day contribution, completion, and extend objective across weeks without duplicating its identity. | [Weekly objectives](https://help.sunsama.com/docs/usage-guides/weekly-objectives) |
| R05 | Weekly planning — Missing | Review prior objectives; extend selected/all; add new objectives; journal and persist a historical plan. Combined review/planning option. | [Weekly planning](https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-planning) |
| R06 | Weekly review — Partial | Objective progress/time allocation, completed work/time by day, weekend inclusion, persistent journal, combined ritual and optional sharing. Default review week: previous Sun–Wed, current Thu–Sat. Existing chart is not the full ritual. | [Weekly review](https://help.sunsama.com/docs/usage-guides/weekly-objectives/weekly-review) |
| R07 | Agentic daily planning — Missing, beta | Explicit opt-in beta. Connected tools + user's brief/themes/rules shape a draft; inspect action list, judgment calls, per-action/all undo, re-plan and assistant explanation. A deterministic scheduling button must not be labeled equivalent AI. | [Daily planning / Autoplan](https://help.sunsama.com/docs/usage-guides/daily-planning) |
| R08 | AI recommendations / assistant — Missing | Sunny chat changes planner state with reviewable results; task-history-based channel/estimate suggestions; configurable daily-highlight summaries. Separate account/provider setup and permissions are necessary. | [Sunny](https://help.sunsama.com/docs/usage-guides/sunny), [Settings](https://help.sunsama.com/docs/settings/user-settings) |

## Focus, keyboard and device capabilities

| ID | Capability / baseline | Behavioral acceptance criteria | Official evidence |
|---|---|---|---|
| F01 | Focus workspace — Partial | Edit notes/subtasks, capture without losing focus, view upcoming events, move between tasks, and advance to next incomplete task on completion. Empty queue shows done state. Configurable auto-enter when timing. | [Focus mode](https://help.sunsama.com/docs/usage-guides/focus-mode) |
| F02 | Stopwatch correctness — Partial | One active work timer; pause/resume/switch/complete records elapsed work once. Reload/background/sleep recover timestamp-based duration; no duplicate credits. Break time never counts as task work. | [Times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times) |
| F03 | Pomodoro / breaks — Missing | Configurable work/break lengths; count-up/countdown views; take break now, snooze 5 minutes, skip/reset, end break early, adjust next reminder. Persist phase correctly. | [Breaks](https://help.sunsama.com/docs/usage-guides/breaks) |
| F04 | External focus bar — Missing | Desktop floating bar visible over other apps, movable, complete/next/play/pause, global show/hide and timer shortcuts; sound timing/volume/settings. Current in-page footer is not equivalent. | [Focus bar](https://help.sunsama.com/docs/usage-guides/focus-bar) |
| F05 | Menu bar/tray — Missing | macOS task/timer/events menu with join meeting, break and completion; Windows/Linux tray actions. Configurable visibility, timer precision and task-name display on macOS. | [Menu bar](https://help.sunsama.com/docs/usage-guides/menu-bar) |
| F06 | Global capture — Missing | With desktop client running, system-wide shortcut opens task window from another app; saves and returns focus; configurable shortcut. Browser-only shortcut does not pass. | [Global add task](https://help.sunsama.com/docs/usage-guides/keyboard-driven-actions/global-add-task) |
| F07 | Keyboard task actions — Partial | Highlight task with arrows; open, complete, timer, focus, schedule, defer, backlog, delete, linked source shortcuts target it. Text entry does not trigger global app commands. | [Keyboard shortcuts](https://help.sunsama.com/docs/usage-guides/keyboard-driven-actions/keyboard-shortcuts) |
| F08 | Command palette — Missing | Cmd/Ctrl+K searchable contextual commands, task search, navigation, settings, sorting; unavailable commands visibly disabled. Works when ordinary shortcuts are disabled. | [Command palette](https://help.sunsama.com/docs/usage-guides/keyboard-driven-actions/command-palette) |
| F09 | Desktop distribution — Missing | Installable macOS/Windows/Linux builds, sign-in, persistence and operating-system facilities. A website/PWA can improve access but does not alone meet native behavior. | [Desktop](https://www.sunsama.com/desktop), [FAQ](https://help.sunsama.com/docs/faq/faq) |
| F10 | Mobile/native — Missing | Native iOS/iPadOS and Android delivery, task/backlog/priority workflows and appropriate touch controls. Test real devices. Do not assume mobile Sunsama has identical desktop scope: official site calls it a companion app. | [Mobile](https://www.sunsama.com/mobile), [Priority](https://help.sunsama.com/docs/usage-guides/tasks/task-priority), [FAQ](https://help.sunsama.com/docs/faq/faq) |

## Wider product surface that still prevents a “100%” claim

- **Integrations:** the catalog lists Gmail, Outlook email, Asana, ClickUp, GitHub, Jira, Linear, MCP, Microsoft Planner, Teams, Microsoft To Do, Monday, Notion, Todoist, Trello, Slack, Zapier, Toggl, Apple Reminders and Google Tasks. Each needs its own import/status/action behavior and live authentication verification. Do not count an app's logo, exported file or generic URL field as a functioning integration. Canonical help URLs are `https://help.sunsama.com/docs/integrations/<slug>` with slugs shown by the live catalog.
- **Email capture and summaries:** incoming email-to-task, calendar meeting import, source previews and bidirectional completion require durable external service handling. [Email forwarding](https://help.sunsama.com/docs/usage-guides/email-forwarding).
- **Workspace/account:** teammate permissions, private/shared channels, membership, account export and account/session controls are separate from single-user Sites authentication. [Workspace settings](https://help.sunsama.com/docs/settings/workspace-settings), [Teammates](https://help.sunsama.com/docs/faq/using-with-teammates).
- **Display/settings:** dark/system theme, per-day capacity, completed-task visibility, configurable shortcut/focus/sound settings, timezone and time format have independent behaviors. [Settings](https://help.sunsama.com/docs/settings/user-settings).
- **Visual fidelity:** this audit uses documentation and Daylight source, not a side-by-side exhaustive UI recording. Visual parity is unverified. The independent Daylight branding is explicit; it should not imply official affiliation.

## Implementation order and release evidence

1. Evolve the model with backward-compatible defaults: occurrence series, daily time entries, multiple sessions, priority/bucket/folder fields, ritual records and focus phases. Preserve old account state and JSON imports.
2. Add deterministic lifecycle tests for midnight/DST/offline catch-up, recurrence collision/edits, time ledger, priority decay and archive. Add scheduling fixtures with busy/free events, split intervals, early completion, manual pins and overflow.
3. Implement usable UI for those capabilities; test repeated interactions and persistence, not appearance alone. In particular, calendar pointer dragging, app refresh mid-timer and ritual create/edit/resume need browser validation.
4. Mark acceptance cases as verified only with build/test/browser evidence. Verify production sign-in and stored changes after reload before declaring hosted readiness.
5. Keep integration/native/AI rows explicitly partial or missing until deployed and authenticated end-to-end. OAuth access, provider configuration, signing/distribution and physical authentication can require user action; list concrete remaining prerequisites.

No completion percentage is justified by this audit. It is not a contractual specification of undocumented Sunsama behavior; ambiguities should be recorded and tested rather than silently invented.


## November 7, 2026 follow-up

Official documentation rechecked for keyboard actions, subtask/parent time accounting, recurrence edits/navigation, preferred-time scheduling, channel/day working hours and priority persistence. A read-only comparison of the installed Sunsama board informed Daylight's denser toolbar, gray work surface, daily columns, card controls and right backlog. This comparison is not a pixel-fidelity certification.

- https://help.sunsama.com/docs/usage-guides/keyboard-driven-actions/keyboard-shortcuts
- https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times
- https://help.sunsama.com/docs/settings/user-settings
- https://help.sunsama.com/docs/usage-guides/tasks/recurring-tasks
- https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-auto-scheduling
- https://help.sunsama.com/docs/usage-guides/timeboxing/timeboxing-customizing-settings
- https://help.sunsama.com/docs/usage-guides/tasks/task-priority
- https://help.sunsama.com/docs/usage-guides/daily-planning/legacy

The current documented Parallel Time beta allows adjacent parallel work to use the maximum task duration in projections. Daylight does not implement this beta. Provider integrations and native clients remain separate external work; the current checklist is authoritative about what was actually verified.
