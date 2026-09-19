CREATE TABLE `likes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_likes_user_message` ON `likes` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `idx_likes_message` ON `likes` (`message_id`);--> statement-breakpoint
CREATE TABLE `saved_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_key` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_user_kind_key` ON `saved_items` (`user_id`,`kind`,`item_key`);--> statement-breakpoint
ALTER TABLE `messages` ADD `channel` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `reply_to` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `edited_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_messages_channel_created` ON `messages` (`channel`,`created_at`);