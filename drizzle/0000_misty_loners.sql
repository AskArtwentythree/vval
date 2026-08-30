CREATE TABLE `verification_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`external_user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_applicant_id` text,
	`provider_inspection_id` text,
	`status` text NOT NULL,
	`reason_code` text,
	`level_name` text,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_attempts_external_user_id_unique` ON `verification_attempts` (`external_user_id`);--> statement-breakpoint
CREATE INDEX `verification_attempts_provider_applicant_id_idx` ON `verification_attempts` (`provider_applicant_id`);--> statement-breakpoint
CREATE TABLE `verification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`provider_event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`reason_code` text,
	`payload_hash` text NOT NULL,
	`received_at` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `verification_attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_events_provider_event_id_unique` ON `verification_events` (`provider_event_id`);--> statement-breakpoint
CREATE INDEX `verification_events_attempt_id_idx` ON `verification_events` (`attempt_id`);