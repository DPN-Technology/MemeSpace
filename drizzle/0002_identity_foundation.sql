CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text COLLATE NOCASE NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer DEFAULT 0 NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);
