CREATE TABLE `auth_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `banned_emails` (
	`email` text PRIMARY KEY NOT NULL,
	`banned_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `otps` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
