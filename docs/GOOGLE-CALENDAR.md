# Direct Google Calendar integration

Status: Google registration and read/write authorization completed November 7, 2026. Hosted calendar refresh and publishing controls verified; an actual external event write has not been performed. This is a separate provider OAuth connection, not a Sites connector declaration.

## Registration completed

- Dedicated Google Cloud project: Daylight Planner (`ultra-sound-514019-a3`). No billing account was linked as part of this setup.
- Google Calendar API enabled after explicit user approval of Google's API terms.
- OAuth branding created as Daylight Planner, external/testing audience, owner support/contact email. User Data Policy accepted with explicit user approval.
- Web application OAuth client created as Daylight private planner. Its only authorized redirect URI: `https://daylight-rand-planner.rand-almomen.chatgpt.site/api/google-calendar/callback`. Do not use the Sites-reserved `/callback` route. Server OAuth does not need JavaScript origins.
- The owner's Google account is the sole test user. Registration does not replace Sites authentication or make Daylight public.

## Runtime configuration

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_TOKEN_ENCRYPTION_KEY` are configured as Sites secrets (environment revision 2). Never include them in source, deployment archives, browser state, or the hosting manifest. The encryption key must be 32 cryptographically random bytes encoded as base64url. Keep it stable; changing it requires reconnecting existing accounts.

`DAYLIGHT_PUBLIC_URL` is configured as the exact published origin. The client ID is public but is also stored as a secret here. For isolated development, use a separate authorized localhost callback and ignored `.env.local` configuration. Preserve existing OpenAI settings.

The generated `0001_magical_prowler.sql` migration is deployed. It adds two tables without changing existing planner data. Sites applies tracked migrations during deployment.

## Permissions and handling

Initial scopes: `openid`, `email`, `calendar.calendarlist.readonly`, `calendar.events.readonly` under Google's scope prefix. Optional publishing requests `calendar.events.owned` only when the user enables it. No Gmail, Contacts, Drive, calendar ACL, or domain-wide delegation permissions are requested.

OAuth attempts are bound to the signed-in Sites user, use random hashed state plus PKCE, expire after ten minutes, and are consumed once. Refresh/access tokens and PKCE verifiers use AES-GCM encryption with account-bound authenticated data. The browser receives only connection metadata and normalized event blocks. Access tokens refresh on the server before expiry. Revoked/expired access surfaces a reconnect action. Disconnect attempts Google revocation and removes local credentials even if Google's revocation endpoint is unavailable.

Event titles/times are stored in the account-owned planner and may appear in that user's backup/export. Google event details and identifiers are not sent to the optional AI assistant; its context includes only busy/free intervals. A meeting explicitly imported into a task is then ordinary task content.

## Behavior and limits

- One Google account per Daylight account; select up to eight readable calendars.
- Refreshes on date changes, manually, and every five minutes while the app is open and visible. Window: selected date minus seven days through selected date plus 35 days (exclusive).
- Full bounded pagination expands recurring instances and reconciles cancellations/edits within successful calendar windows. A failed calendar refresh preserves its previous events. There is no push webhook, closed-app background refresh or incremental sync token.
- Timed, multi-day, all-day and transparent/free events are supported. Declined events and previously published Daylight sessions are omitted to avoid duplicate timeboxes. All-day busy events reserve the day. Wall-clock display cannot distinguish both repeated hours at DST fall-back; duration remains positive.
- Google events are read-only in Daylight, link to Google editing, and can become tasks. Local task timeboxes remain editable.
- Publishing is explicit, limited to 30 unfinished timeboxes on the selected day and a calendar the account owns. Uses stable event IDs, checks private ownership metadata and ETags before updates, refuses shared/attendee events, and sends no invitations. Ambiguous failures are shown without automatic replay.
- Moving/deleting a timebox does not automatically move/delete its Google event. Publish again for updates; remove obsolete events in Google. Google-side changes do not move local timeboxes. Disconnect retains published events and imported tasks.
- Testing-mode Google OAuth refresh tokens generally expire after seven days for these scopes. Production/personal-use verification requirements need to be resolved before promising unattended long-term access.

## Live verification

- Google registration, sole test-user access, credential storage and private deployment completed.
- Hosted read authorization, initial refresh and read-to-write scope upgrade completed through Google consent.
- Daylight exposes owned-calendar destinations and Publish/update controls; the initial window refresh completed without an error.
- Still to verify: a controlled real event edit/cancellation, token refresh after access-token expiry, and an explicitly chosen disposable timebox publish/update. Provider writes were not triggered merely to verify a permission grant.
- Local automated tests cover recurrence expansion, all-day/multi-day/DST handling, encryption, pagination, safe reconciliation, deterministic publishing, ETag checks and ambiguous-write handling.

References: [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).
