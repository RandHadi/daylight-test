CREATE TABLE `planner_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`before_payload` text NOT NULL,
	`draft_payload` text NOT NULL,
	`report` text NOT NULL,
	`created_at` integer NOT NULL
);
