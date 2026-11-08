# Sunsama browser walkthrough — November 7, 2026

Observed the signed-in Sunsama web interface, using navigation and menus only. No source tasks, integrations, or account settings were changed.

## Observations and corresponding Daylight work

- Left navigation has a collapse control; Backlog contains an Add folder action and nested folder navigation. Daylight now supports collapse/expand, persistent device view preferences, folder creation in the navigation, and folder-filtered backlog.
- The top channel filter opens a searchable channel/context menu. Daylight uses the same accessible control in all workspace views, including analytics and backlog.
- View menu lists Board, Calendar · One day, Calendar · Three days, Calendar · Weekdays, Calendar · Week, Calendar · Month. Daylight adds all six, with event/task details, time-slot creation, drop-to-schedule, month boundaries, and previous/next navigation. Board retains horizontal infinite date scrolling.
- Sunsama keeps a right icon rail while displaying Tasks, Calendar, provider tools, Objectives, Backlog, Archive, and Search in adjacent panels. Daylight now keeps its Tasks, Calendar, Backlog, Objectives, Integrations, Analytics, Archive, Search, AI, and shortcut tools visible, with independent panel collapse.
- Full backlog groups unscheduled tasks into next week or two, next month, next quarter, next year, someday, and never. The folder menu offers all and uncategorized tasks. Daylight adds grouped horizons and identical horizon/folder/priority filtering to the full and side backlog views; empty filtered groups are explicit.
- Analytics displays weekly channel totals, daily stacked time bars, weekend inclusion, context selection, date navigation, and Download. Daylight adds actual/planned totals, completed counts, channel/context filters, weekend toggle, actual/planned chart selection, accessible daily table, and CSV export. Actual time uses the session ledger rather than recounting current task totals. Archived history remains included; deleted tasks are excluded.
- Keyboard help is searchable and grouped. Source examples include Cmd+K, ?, < and > panels, Shift+C/B/T/R side panels, Shift+arrows date navigation, Cmd+D duplication, S schedule today, and Cmd+Z undo. Daylight implements these additions and documents its existing bindings. Q continues to mean Quick capture in Daylight; desktop-global shortcuts and every editor-specific source binding are not implemented.
- Integration settings include Calendar, email, Asana, ClickUp, GitHub, Jira, Linear, MCP, Microsoft providers, Monday.com, Notion, Todoist, Trello, Slack, Zapier, Toggl, Apple Reminders, and Google Tasks. The user's rail visibly includes Gmail, Notion, GitHub, and Google Tasks. The user explicitly deferred new live providers ("none for now"). Daylight's new hub exposes its working direct Google Calendar connection, ICS import, and duplicate-safe Sunsama task/history import. No unavailable provider is shown as connected.

## Scope boundaries

This release improves the observed workspace workflow and does not claim complete Sunsama feature parity. New provider connections, OS-global shortcuts, full calendar event editing against external providers, and source-specific integration previews remain separate work. Existing private access, data, OAuth credentials, attachment storage, sync safeguards, and centered task-details UI are preserved.
