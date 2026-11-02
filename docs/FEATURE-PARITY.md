# Daylight feature parity checklist

Updated November 2, 2026. Reference: Sunsama's official help articles researched November 1, 2026. This is an independent implementation, not an official Sunsama client. **This release is not 100% Sunsama parity.** The full baseline, source URLs and acceptance criteria are in [sunsama-audit-research.md](sunsama-audit-research.md).

Statuses describe behavior, not a percentage: **Verified** means the stated Daylight acceptance case passed; **Partial** means working behavior exists with material gaps; **Missing** means not implemented; **Blocked** identifies an external prerequisite. Unit-tested behavior does not establish pixel fidelity, hosted authentication or external-provider integration.

## Current acceptance matrix

| Audit IDs | Capability | Status | Evidence and remaining differences |
|---|---|---|---|
| T01 | Task details, notes and subtasks | Partial | Creation/edit/reload work; notes are plain text, not a rich-text editor. |
| T02 | Quick capture | Verified | Browser-tested explicit date, duration, priority and channel directives. Plain language is handled separately by AI drafts. |
| T03 | Independent recurrence | Verified | Daily, weekdays, weekly, selected weekdays, intervals, monthly and end-date rules generate 21 days ahead without completion. Idempotence and month-end policy tested. |
| T04 | Series editing/stopping | Partial | Apply edits to future incomplete instances; stop archives future incomplete instances, preserving completed history. Previous/next occurrence navigation is absent. |
| T05 | Approximate recurring time | Partial | Preferred start constrains scheduler; nearest-slot fallback before the preference is not implemented. |
| T06 | Automatic rollover | Verified | Runs on opening and date change; repeated processing is idempotent. Completed tasks and backlog remain in place. |
| T07 | Recurrence collisions | Verified | Pristine collisions archive; edited or logged occurrences are preserved. No destructive deletion. |
| T08 | Automatic archive | Partial | Configurable incomplete-day threshold and restore to backlog. Complete Sunsama inactivity heuristics and archive triage are not reproduced. |
| T09 | Trash and recovery | Partial | Soft-delete, restore, and undo; no permanent purge UI. |
| T10 | Merge/unmerge | Partial | Merge preserves notes, subtasks and time ledger; undo exists. No later unmerge or external integration metadata. |
| T11 | URL capture | Partial | Source link field and URL detection; no connected provider metadata preview. |
| B01 | Backlog buckets | Verified | Six horizons with filtering and task editor selection. |
| B02 | Backlog folders | Partial | Create/filter/remove folders; scheduling clears folder. No nested folders. |
| B03 | Daily/backlog priorities | Partial | Four daily and five backlog levels; rollover resets daily priority and preserves backlog priority. Per-level decay settings absent. |
| B04 | Auto-sort | Partial | Optional priority/preferred-time sort respects pinned tasks and running timer. Full Sunsama chronological/manual-override behavior differs. |
| B05 | Channels/contexts | Partial | Create/edit name, context, color and default channel; custom contexts filter in sidebar. No channel-disable UI or shared/private contexts. |
| B06 | Work capacity | Partial | Personal context excluded from planning warnings; weekday capacities supported. Board totals still show all task estimates. |
| B07 | Search/navigation | Partial | All matching task/note/subtask results, including archive; no advanced query filters. |
| C01 | Timebox manipulation | Partial | Calendar event pointer drag verified; independent timebox date/start/duration controls exist. Drag-resize handles absent. |
| C02 | Multiple sessions | Verified | Multiple timeboxes on one or multiple days remain independent; editing task preserves them and an active timer. Browser-tested two timeboxes. |
| C03 | Automatic scheduling | Partial | Splits work around busy events, respects gaps, preferred start and remaining time, reports overflow, avoids past slots today. Per-channel/per-weekday working hours absent. |
| C04 | Conflict reflow | Partial | Optional reflow protects fixed sessions, moves flexible ones, supports undo; incomplete work stays in task list. Does not exactly reproduce Sunsama's edit-specific undo semantics. |
| C05 | Early completion | Partial | Remaining work can reflow with auto-reschedule enabled. No exact contiguous-group truncation algorithm. |
| C06 | Playlist projections | Partial | Read-only deterministic preview respects remaining time and pins. Full persistent playlist preferences and provider interaction are absent. |
| C07 | Daily time ledger | Verified | Pause/switch/finish record once; sessions split at saved-timezone midnight; moving a task does not move history. Legacy totals retain explicit approximate attribution. |
| C08 | Subtask timing | Missing | Subtask checklists exist; individual subtask estimates/timers do not. |
| C09 | Calendar routing/settings | Partial | Internal busy/free events, pinned/flexible sessions; no destination-provider routing or shared-event privacy controls. |
| C10 | Live calendar integrations | Blocked | Sites eligibility discovery is unavailable in this session. No Google/Outlook/Apple/CalDAV connector was declared or simulated. ICS import/export is a one-time transfer only. |
| C11 | Meeting import | Partial | Imported/internal events can become tasks with source identity and duplicate prevention. No live automatic event import/filter system. ICS parsing/merge tested; browser file-picker upload verification stalled. |
| C12 | Timezone/time format | Partial | Saved IANA timezone drives exports, sessions and today's date; DST tested. Travel prompt and configurable 24-hour display absent. |
| R01 | Manual daily ritual | Partial | Selected/future-day planning, capacity, scheduling and completion work. Browser-tested returning to ritual after adding a task. No external task import/share step. |
| R02 | Ritual reminders | Missing | No scheduled daily/weekly prompt engine or closed-app push service. |
| R03 | Shutdown/highlights | Partial | Reflection, manual highlights, stars, ordering, completed-task capture. No nesting, emoji prompts or external delivery. |
| R04 | Weekly objectives | Partial | Link tasks, create tasks from objectives, complete and extend into next week. Full multi-week identity/history and time allocation UI absent. |
| R05 | Weekly planning | Partial | Prior objective carry, new outcomes and saved weekly journal; browser-tested persistence. No combined full ritual configuration. |
| R06 | Weekly review | Partial | Date-based time ledger charts and saved reflections. Full objective/channel breakdown and sharing absent. |
| R07 | Agentic planning beta | Partial | OpenAI-backed draft planning with explicit apply and undo. It uses Daylight context only; not Sunsama's connected-tool Autoplan. |
| R08 | AI assistant | Partial | Real API draft/create/update/schedule/priority actions; validated IDs, review, one-time apply. Local end-to-end success. Hosted secret configured; hosted visitor verification tracked separately. |
| F01 | Focus workspace | Partial | Notes/checklists editable while timing, complete-and-next queue. No upcoming-meeting panel or capture within focus. |
| F02 | Stopwatch | Verified | Timestamp-based pause/resume/switch/complete, split-at-midnight ledger and single credit tests. |
| F03 | Pomodoro/breaks | Partial | Configurable intervals, automatic work cutoff, break countdown, extend/skip/end, optional open-app notifications. Core browser break flow tested; actual OS notification delivery unverified. |
| F04 | External floating focus bar | Missing | Only the in-page focus bar exists. |
| F05 | Native menu bar/tray | Missing | Requires a native desktop client. |
| F06 | System-wide capture | Missing | In-app quick capture works; no operating-system shortcut. |
| F07 | Keyboard task actions | Partial | Existing app/navigation shortcuts and quick capture. Full hover/selection task command map absent. |
| F08 | Command palette | Partial | Cmd/Ctrl+K searches app actions and opens task search. Full contextual task actions absent. |
| F09–F10 | Native desktop/mobile apps | Missing | Responsive web app only; native builds, signing, distribution and real-device QA remain. |
| — | Dark/light/system display | Partial | Themes implemented; system preference evaluated when selected. Not every component contrast/state is exhaustively audited. |
| — | Draft recovery/concurrency | Partial | Per-account local draft recovery, online retry and revision-conflict rejection. Full offline app loading and automatic multi-device merge absent. |
| — | Team workspaces/account administration | Missing | Private single-user Sites authentication; no teammate roles, shared channels or enterprise account features. |
| — | Exact appearance | Unverified | Original Daylight branding and layout. No pixel-by-pixel Sunsama UI comparison. |

## External integration inventory

All live integrations below remain **Missing/Blocked**. No provider logo or file export is counted as a connection:

Google Calendar, Outlook Calendar, Apple/iCloud, CalDAV, Gmail, Outlook Email, Asana, ClickUp, GitHub, Jira, Linear, MCP, Microsoft Planner, Microsoft Teams, Microsoft To Do, Monday.com, Notion, Todoist, Trello, Slack, Zapier, Toggl Track, Apple Reminders and Google Tasks. Email forwarding and external activity summaries also remain absent.

The Sites integration instructions require `list_plugin_eligibility` before declaring a connector. That capability was not exposed in the current tool inventory. Native ChatGPT connectors alone do not establish permission to use them in a hosted Site. Implementing a separate provider OAuth stack would require approved provider app registrations, callback URLs, scopes and account consent.

## Verified release checks

- 29 automated cases across recurrence, rollover, archive, collision handling, scheduling, independent sessions, time accounting, timezone/DST, ICS parsing/merge and AI action validation.
- TypeScript no-emit check and production build.
- Eight local API checks: signed-in read, unauthenticated rejection, same-origin enforcement, invalid payload rejection, stale-revision rejection, assistant access checks and configured state.
- Local browser: quick capture, recurrence before completion, reload persistence, AI proposal/apply, weekly journal, multiple timeboxes, calendar pointer move, focus/pause/break, future-day ritual with task capture, mobile layout.
- The calendar file-picker test stalled in browser automation. Parser and merge tests passed; end-to-end upload remains unverified.
- Hosted publication and visitor sign-in/save/AI verification must be recorded separately after deployment. A build or saved secret does not prove hosted user access.

## Remaining project work

1. Verify hosted visitor sign-in, save/reload and AI request.
2. Enable supported connection discovery and implement/verify real calendar sync before relying on Daylight as a full replacement.
3. Complete the Partial web behavior rows using the detailed acceptance criteria in the baseline audit.
4. Build, sign and test native apps for global capture, menu/tray and floating focus features.
5. Run comparative visual and workflow QA against Sunsama before making any exact-parity claim.
