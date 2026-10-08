CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL, customer_id TEXT UNIQUE, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE subscriptions (user_id TEXT PRIMARY KEY REFERENCES users(id), subscription_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, price_id TEXT NOT NULL, period_end INTEGER NOT NULL, cancel_at_period_end INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE mixes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, mood TEXT NOT NULL, settings TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX mixes_user ON mixes(user_id,created_at);
--> statement-breakpoint
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mood TEXT NOT NULL, seconds INTEGER NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX sessions_user ON sessions(user_id,created_at);
--> statement-breakpoint
CREATE TABLE billing_events (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
