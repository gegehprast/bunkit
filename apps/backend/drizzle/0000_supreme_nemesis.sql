CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_by` text,
	`is_admin` integer DEFAULT false NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `delivery_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`target_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_number` integer DEFAULT 1 NOT NULL,
	`next_retry_at` integer,
	`response_status` integer,
	`response_body` text,
	`response_latency_ms` integer,
	`error_message` text,
	`is_replay` integer DEFAULT false NOT NULL,
	`original_attempt_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `webhook_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `delivery_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `delivery_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`retry_backoff_seconds` integer DEFAULT 60 NOT NULL,
	`throttle_rps` integer,
	`outbound_signing_scheme` text DEFAULT 'none' NOT NULL,
	`outbound_signing_secret` text,
	`headers` text,
	`enabled` integer DEFAULT true NOT NULL,
	`is_test` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `filter_conditions` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`field` text NOT NULL,
	`field_key` text,
	`operator` text NOT NULL,
	`value` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`rule_id`) REFERENCES `filter_rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `filter_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`name` text NOT NULL,
	`logic_operator` text DEFAULT 'AND' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`drop_on_match` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_receiver_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`receiver_id` text NOT NULL,
	`method` text NOT NULL,
	`headers` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`received_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`receiver_id`) REFERENCES `test_receivers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `test_receivers` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`target_id` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `delivery_targets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_receivers_target_id_unique` ON `test_receivers` (`target_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `test_receivers_token_unique` ON `test_receivers` (`token`);--> statement-breakpoint
CREATE TABLE `webhook_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`signing_scheme` text DEFAULT 'none' NOT NULL,
	`signing_secret` text,
	`custom_signature_header` text,
	`custom_signature_encoding` text DEFAULT 'hex',
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webhook_endpoints_slug_unique` ON `webhook_endpoints` (`slug`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint_id` text NOT NULL,
	`method` text NOT NULL,
	`headers` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`source_ip` text,
	`received_at` integer NOT NULL,
	`matched_rule_id` text,
	`signature_valid` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matched_rule_id`) REFERENCES `filter_rules`(`id`) ON UPDATE no action ON DELETE no action
);
