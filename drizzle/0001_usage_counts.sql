CREATE TABLE usage_counts (day TEXT NOT NULL, event TEXT NOT NULL, mood TEXT NOT NULL DEFAULT '', preset TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0, seconds INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,event,mood,preset));
--> statement-breakpoint
CREATE TABLE usage_receipts (id TEXT PRIMARY KEY, day TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX usage_receipts_day ON usage_receipts(day);
