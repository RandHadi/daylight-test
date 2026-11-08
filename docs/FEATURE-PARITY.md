# Daylight feature parity checklist

Updated November 7, 2026. Reference: Sunsama's official help articles researched November 1 and November 7, 2026, plus a read-only native board comparison. This is an independent implementation, not an official Sunsama client. **This release is not 100% Sunsama parity.** The full baseline, source URLs and acceptance criteria are in [sunsama-audit-research.md](sunsama-audit-research.md).

Statuses describe behavior, not a percentage: **Verified** means the stated Daylight acceptance case passed; **Partial** means working behavior exists with material gaps; **Missing** means not implemented; **Blocked** identifies an external prerequisite. Unit-tested behavior does not establish pixel fidelity, hosted authentication or external-provider integration.

## Current acceptance matrix

### Calendar date shortcut (November 8, 2026, v20)

- Clicking the date heading in the right calendar opens the full week containing that date and swaps the right panel to that day's tasks, preserving channel filters and week-start preference.
- Week headers select the day shown in the task panel. The panel includes channel filtering, collapse, and a return-to-board control. The selected panel persists with the saved layout.
- Seven day columns fit the desktop calendar without hiding the last day; scrolling remains available on narrower screens. The selected date is highlighted, and the toolbar includes a week range and This week control.
- Local browser checks covered date shortcut, day selection, returning to the board, repeated switching, and reload persistence. Type checking and the three calendar-window tests passed.

### Readable reference palette (November 8, 2026, v18–19)

- Compared the signed-in Sunsama native board and calendar. Matched the neutral gray surfaces, charcoal content, stronger secondary labels, white cards and visible card borders more closely.
- Removed faded completed-card and planned-event opacity. Calendar blocks retain their source colors at full strength, choose contrasting text, and keep actual-time stripes and projection indicators.
- Applied the palette to navigation, channel labels, the calendar menu, task details and time labels. Existing user colors, tasks and settings are unchanged.
- Validated the local board, task details, calendar, and dark theme; checked foreground contrast for the existing calendar palette and black/white/mid-gray edge colors. Type checking and production build passed. Hosted verification confirmed the palette and prompted a refinement so grouped Google/planned events retain solid fills. This is a visual alignment, not a claim of exact pixel parity.

| Audit IDs | Capability | Status | Evidence and remaining differences |
|---|---|---|---|
| T01 | Task details, notes and subtasks | Partial | Task details, safe Markdown writing/preview, planned/actual subtasks and promotion. Full rich-text/WYSIWYG editing remains different. |
| T02 | Quick capture | Verified | Browser-tested explicit date, duration, priority and channel directives. Plain language is handled separately by AI drafts. |
| T03 | Independent recurrence | Verified | Daily, weekdays, weekly, selected weekdays, intervals, monthly and end-date rules generate 21 days ahead without completion. Idempotence and month-end policy tested. |
| T04 | Series editing/stopping | Partial | Previous/next occurrence navigation, future or all-incomplete series edits and stop. Completed history and subtask time identities are preserved; exact external-provider recurrence behavior remains absent. |
| T05 | Approximate recurring time | Partial | Nearest feasible preferred slot, including earlier slots, tested. Timed recurrence defaults rigid and loses rigidity after rollover; complete provider edit interactions remain unverified. |
| T06 | Automatic rollover | Verified | Runs on opening and date change; repeated processing is idempotent. Completed tasks and backlog remain in place. |
| T07 | Recurrence collisions | Verified | Pristine collisions archive; edited or logged occurrences are preserved. No destructive deletion. |
| T08 | Automatic archive | Partial | Configurable incomplete-day threshold and restore to backlog. Complete Sunsama inactivity heuristics and archive triage are not reproduced. |
| T09 | Trash and recovery | Partial | Soft-delete, restore, and undo; no permanent purge UI. |
| T10 | Merge/unmerge | Partial | New merges can be unmerged later, restoring source identity, subtasks, ledger and timeboxes. Unit/browser verified. Legacy merges lack restore metadata; nested merges and external metadata unsupported; stopped recurrence is not restarted by unmerge. |
| T11 | URL capture | Partial | Source link field and URL detection; no connected provider metadata preview. |
| B01 | Backlog buckets | Verified | Six horizons with filtering and task editor selection. |
| B02 | Backlog folders | Partial | Create from left navigation, filter all/uncategorized/specific folders, and remove in settings; new backlog tasks inherit the selected folder/horizon. Scheduling clears folder. No nested folders. |
| B03 | Daily/backlog priorities | Verified | Four daily and five backlog priorities. Configurable per-level persistence on rollover; repeated rollover and backlog preservation tested. |
| B04 | Auto-sort | Partial | Optional priority/preferred-time sort respects pinned tasks and running timer. Full Sunsama chronological/manual-override behavior differs. |
| B05 | Channels/contexts | Partial | Edit name, context, color, defaults and disable/enable channels. Custom context filters. No shared/private contexts or team permissions. |
| B06 | Work capacity | Verified | Personal context excluded from work-capacity warnings, with weekday capacities. Board totals deliberately show all planned tasks. |
| B07 | Search/navigation | Partial | All matching task/note/subtask results, including archive; no advanced query filters. |
| B08 | Workspace views and panels | Partial | Board plus one-day/three-day/weekday/week/month calendars, searchable channel filter, collapsible navigation/panels and persistent right tools rail. Multi-day calendar drag/resize parity remains incomplete. |
| C01 | Timebox manipulation | Partial | Calendar pointer move and drag-resize browser verified. Independent session date/start/duration controls, 5-minute resize and pinning. Exact modifier-key/provider behavior differs. |
| C02 | Multiple sessions | Verified | Multiple timeboxes on one or multiple days remain independent; editing task preserves them and an active timer. Browser-tested two timeboxes. |
| C03 | Automatic scheduling | Partial | Splits around busy events, gaps, preferred times, remaining work and no-past slots. Weekday hours, channel overrides, overflow choices and no-split scheduling tested. Full provider behavior remains absent. |
| C04 | Conflict reflow | Partial | Optional reflow protects fixed sessions, moves flexible ones, supports undo; incomplete work stays in task list. Does not exactly reproduce Sunsama's edit-specific undo semantics. |
| C05 | Early completion | Partial | Early completion truncates an active timebox and releases future sessions without changing past sessions. Optional reflow. Exact contiguous-group rules differ. |
| C06 | Playlist projections | Partial | Read-only deterministic preview respects remaining time and pins. Full persistent playlist preferences and provider interaction are absent. |
| C07 | Daily time ledger | Verified | Pause/switch/finish record once; sessions split at saved-timezone midnight; moving a task does not move history. Legacy totals retain explicit approximate attribution. |
| C08 | Subtask timing | Verified | Subtask planned/actual time, individual timers, switching/completion, promotion and per-day corrections. Parent estimates avoid double counting; ledger identity survives series edits. Unit and browser verified. |
| C09 | Calendar routing/settings | Partial | Internal busy/free events, pinned/flexible sessions; no destination-provider routing or shared-event privacy controls. |
| C10 | Live calendar integrations | Partial | Direct Google OAuth and live refresh verified; read/write consent and owned-calendar publish controls verified. Actual external event publishing remains untested. No Outlook/Apple/CalDAV integration. |
| C11 | Meeting import | Partial | Events become tasks with identity and duplicate prevention. ICS paste preview/import/reimport browser verified; file-picker automation stalled. No live automatic event import or RRULE expansion. |
| C12 | Timezone/time format | Partial | Saved IANA timezone, DST-aware exports/sessions/today and configurable 12/24-hour display. Travel prompt absent. |
| R01 | Manual daily ritual | Partial | Selected/future-day planning, capacity, scheduling and completion work. Browser-tested returning to ritual after adding a task. No external task import/share step. |
| R02 | Ritual reminders | Partial | Open-app daily planning/shutdown reminders, weekday/time settings, per-day shutdown override, snooze and persistent dismissal verified. No weekly reminder engine or closed-app push service. |
| R03 | Shutdown/highlights | Partial | Reflection, manual highlights, stars, ordering, completed-task capture. No nesting, emoji prompts or external delivery. |
| R04 | Weekly objectives | Partial | Link/create tasks, complete/carry objectives while preserving multiweek identity. Full objective time-allocation workflow differs. |
| R05 | Weekly planning | Partial | Prior objective carry, new outcomes and saved weekly journal; browser-tested persistence. No combined full ritual configuration. |
| R06 | Weekly review | Partial | Daily ledger charts, channel/objective breakdown, saved reflections and Markdown export. External delivery/sharing absent. |
| R09 | Analytics | Partial | Dedicated weekly channel totals, daily stacked bars, weekends, actual/planned metrics, channel/context filters and CSV export. Uses saved ledger including imported history; arbitrary date ranges and all source metrics are not implemented. |
| R07 | Agentic planning beta | Partial | OpenAI-backed draft planning with explicit apply and undo. It uses Daylight context only; not Sunsama's connected-tool Autoplan. |
| R08 | AI assistant | Partial | Real API with validated proposals, explicit apply/undo. Local end-to-end apply verified; hosted signed-in AI response verified November 7. Connected-tool actions absent. |
| F01 | Focus workspace | Partial | Notes, timed subtasks, complete/next queue, capture during focus and upcoming meeting. Exact Sunsama focus display differs. |
| F02 | Stopwatch | Verified | Timestamp-based pause/resume/switch/complete, split-at-midnight ledger and single credit tests. |
| F03 | Pomodoro/breaks | Partial | Configurable intervals, automatic work cutoff, break countdown, extend/skip/end, optional open-app notifications. Core browser break flow tested; actual OS notification delivery unverified. |
| F04 | External floating focus bar | Missing | Only the in-page focus bar exists. |
| F05 | Native menu bar/tray | Missing | Requires a native desktop client. |
| F06 | System-wide capture | Missing | In-app quick capture works; no operating-system shortcut. |
| F07 | Keyboard task actions | Partial | Selection/hover actions, arrows, timer, completion, edit, focus, scheduling, defer, backlog, planned/actual, source and undo. Typing shield and shortcut-disable setting. Full contextual command palette remains incomplete. |
| F08 | Command palette | Partial | Cmd/Ctrl+K searches app actions and opens task search. Full contextual task actions absent. |
| F09–F10 | Native desktop/mobile apps | Missing | Responsive web app only; native builds, signing, distribution and real-device QA remain. |
| — | Dark/light/system display | Partial | Themes and system-change listener; light/mobile and dark/desktop checked. Exhaustive contrast audit remains. |
| — | Draft recovery/concurrency | Partial | Per-account local draft recovery, online retry and revision-conflict rejection. Full offline app loading and automatic multi-device merge absent. |
| — | Team workspaces/account administration | Missing | Private single-user Sites authentication; no teammate roles, shared channels or enterprise account features. |
| — | Exact appearance | Partial | Board/sidebar/cards/toolbar refined from the native Sunsama board; desktop/mobile visually inspected. Independent branding and several dialogs differ; no pixel-perfect claim. |

| — | Parallel Time beta | Missing | Parallel task grouping and max-duration projections are not implemented. |

## External integration inventory

Google Calendar has an active direct OAuth connection with read/write permission and verified live refresh. All other integrations below remain **Missing/Blocked**. No provider logo or file export is counted as a connection:

Outlook Calendar, Apple/iCloud, CalDAV, Gmail, Outlook Email, Asana, ClickUp, GitHub, Jira, Linear, MCP, Microsoft Planner, Microsoft Teams, Microsoft To Do, Monday.com, Notion, Todoist, Trello, Slack, Zapier, Toggl Track, Apple Reminders and Google Tasks. Email forwarding and external activity summaries also remain absent.

The Sites integration instructions require `list_plugin_eligibility` before declaring a connector. That capability was not exposed in the current tool inventory. Native ChatGPT connectors alone do not establish permission to use them in a hosted Site. The user authorized a separate Google OAuth stack. Provider registration, secure credentials and read/write consent are complete. Live refresh and publish controls were verified; actual publishing and long-term token refresh remain unverified. See GOOGLE-CALENDAR.md.

## Verified release checks

- 47 automated cases covering recurrence, series-edit time preservation, rollover, scheduling, subtask/session accounting, merge/unmerge, reminders, schema, timezone/DST, ICS and AI actions.
- TypeScript no-emit check. Production build is recorded in the release artifact report after packaging.
- Eight local API checks: signed-in read, unauthenticated rejection, same-origin enforcement, invalid payload rejection, stale revision rejection, assistant access checks and configured state.
- Local browser: subtask plan/timer/actual corrections, recurrence navigation, Markdown preview, calendar resize, task shortcuts, focus capture, merge/unmerge, working-hour save/reload, shutdown reminder/snooze, ICS paste/import/reimport, mobile and dark layout.
- Calendar file-picker automation stalled. Paste-based calendar import is verified; the file-picker path remains unverified.
- Hosted visitor authentication, task save/reload and real AI response passed November 7 before this release. The published-version visual/reload check is recorded separately in the release artifact report.

## Remaining project work

1. Enable supported hosted connector discovery and implement/verify real calendar sync before relying on Daylight as a full replacement.
2. Complete Partial web behavior rows, contextual command actions, Parallel Time beta and richer ritual configuration.
3. Build, sign and test native apps for global capture, menu/tray and floating focus features.
4. Complete exact visual/workflow comparisons, accessibility audits, provider consent and real-device tests before any full-parity claim.

## Direct Google implementation validation · November 7

58 automated cases passed, including 11 new Google encryption, PKCE, timezone/DST, pagination, cancellation reconciliation, schema preservation and explicit publish/idempotence cases. 17 local API checks passed. Local browser checks verified setup status, timed/all-day event display, read-only event details and meeting-to-task import using temporary fixtures; fixtures were restored afterward. Provider authorization, actual calendar reads and the read/write scope upgrade were subsequently verified on the hosted app. Token refresh after expiry and actual external publishing remain unverified.

## Import persistence repair · November 7

Fixed stale draft recovery that could relabel an old snapshot with the current revision after background calendar synchronization. Mismatched or incomplete drafts are now preserved separately while the cloud planner stays active. Conflicted tabs cannot write through background changes, and users can load the latest planner without discarding their pending draft. Idle visible tabs check for newer cloud data. The server also rejects whole-state saves that omit existing non-sample task IDs; deletion and undo use recoverable tombstones.

Validation: 71 unit cases, TypeScript, 17 existing local API checks, and the targeted API regression passed. Local browser testing confirmed concurrent-edit rejection, draft preservation and successful latest-version recovery. Hosted restoration and reload verification are recorded in the release evidence outside source.

## Centered task details · November 7

Replaced the side sheet with a centered, expandable task dialog based on the supplied screenshots. The toolbar provides channel, priority, start-date/snooze/backlog and due-date calendars, subtasks, repeat, objectives, duplicate, recoverable delete and direct task links. Inline planned/actual time, timer start/pause, timed subtasks, notes, private comments, file attachments and new activity history are supported. Existing task edits autosave and closing flushes pending valid edits. Imported tasks retain their existing information; old creation/activity dates are not invented.

Files use the private BUCKET R2 binding through authenticated, same-origin upload and account-owned download endpoints (10 MB per file). Metadata and comments live in the existing planner, with protection against older clients omitting these new fields.

77 automated tests, TypeScript, local API regression checks, attachment byte-for-byte/private-access checks and local browser save/reload checks passed. Desktop, expanded and 390px mobile layouts were checked; menus, date selection, priority, planned time, subtasks, notes, comments, attachment upload, duplicate/delete, backlog positioning, direct links and timer start/pause were exercised. Hosted checks are recorded in the release evidence outside source.

## v12 — workspace walkthrough update (November 7, 2026)

Browser-observed source behavior is documented in `sunsama-walkthrough-2026-11-07.md`.

- Added collapsible left navigation and an always-visible right tools rail, with collapsible Tasks, Calendar, Backlog, Objectives, and Integrations panels.
- Added left-navigation backlog folders, grouped full backlog, and shared all/horizon/folder/uncategorized/priority filters.
- Added a searchable channel/context filter in the workspace toolbar.
- Added calendar one-day, three-day, weekdays, week, and month views alongside the horizontally scrolling board; completed-task visibility and device-local view preferences.
- Added dedicated analytics with weekly channel totals, daily bars, actual/planned metrics, weekend selection, accessible data table, and CSV export based on saved history.
- Added searchable, grouped keyboard help and panel/date/duplicate/today shortcuts. Help accurately describes Daylight's bindings; OS-global and all Sunsama-specific bindings remain incomplete.
- Added an integrations hub for existing Google Calendar, ICS files, and Sunsama imports. New live providers explicitly deferred by the user on this turn.

Validation: 80 unit tests and TypeScript checks passed. Browser checks covered all six view layouts, event date targeting, folder creation/task inheritance, analytics CSV, searchable shortcuts, panel shortcuts, view reload, and a 390px mobile layout with the rail fixed on the right.

## v13 — calendar scrolling

Day, three-day, weekday, and week calendars now scroll horizontally through a replenishing date window and vertically through the hours. Date headers and hour labels remain fixed on their respective axes. Horizontal movement preserves the vertical hour position. Month view scrolls between full months with horizontal snapping. Arrow keys scroll the focused calendar surface. Date windows cross year/month boundaries and weekday mode skips weekends in both directions.

Validation: 83 unit tests and TypeScript checks passed. Local browser verification covered horizontal movement in both directions, edge replenishment, vertical-hour preservation, sticky date headers, month/year crossing, weekday windows, and a 390px layout without page overflow.
# Calendar selection and task layers (v14)

- Added the Calendars popover to the right calendar panel and main calendar toolbar, using the supplied reference layout and Daylight branding.
- The shared, saved display preferences control local events, task projections, actual time, planned-versus-actual comparison, completion marks, and individual Google calendars grouped under the connected account.
- Existing synced calendars can be hidden without deleting events or freeing their busy time. Selecting an unsynced calendar uses the existing authorized Google connection and its eight-calendar limit. Manage calendars opens the existing Google settings.
- Actual time uses recorded timer/import timestamps, split in the planner timezone. Manual or legacy entries without timestamps appear as day totals; no clock times are invented. Completed tasks without timed records appear in the day header. Projections are display-only and never create saved timeboxes.
- Validated source filters, independent layers, timezone boundaries, archive/deletion/channel filters, non-mutating projections, and saved settings. Browser checks cover both calendar menus, reload persistence, Escape/outside dismissal, Manage calendars, and a 390px viewport.

# Matching calendar entries (v16)

- Exact planned/actual intervals for one task now share one calendar card. A single Google event with the same title, date, and interval joins that card, labeled Google / Planned / Actual.
- Different times remain separate for comparison. Multiple matching Google calendars, distinct tasks, and overlapping time entries remain separate when the match is ambiguous.
- Grouping changes display only. The source task, Google event, saved timeboxes, and time ledger remain intact; a grouped-card dialog opens each source's details.
- Regression coverage includes the reported three-card case, all calendar visibility combinations, mismatched intervals, multiple calendars/tasks, and overlapping actual entries. All 97 tests pass. Unchanged Google refreshes preserve block order and skip redundant planner saves.

