CREATE TABLE `google_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_tokens` text NOT NULL,
	`email` text NOT NULL,
	`scopes` text NOT NULL,
	`calendars` text DEFAULT '[]' NOT NULL,
	`selected` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_oauth_attempts` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`encrypted_verifier` text NOT NULL,
	`mode` text NOT NULL,
	`expires_at` integer NOT NULL
);
