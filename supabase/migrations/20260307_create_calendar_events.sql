-- Migration for calendar_events table
CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "event_date" date NOT NULL,
    "multiplier" numeric NOT NULL DEFAULT 1.0,
    "created_at" timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE
);
-- Enable RLS
ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;
-- Policies
CREATE POLICY "Users can insert their own events." ON "public"."calendar_events" FOR
INSERT WITH CHECK (can_access_owner_data(user_id));
CREATE POLICY "Users can view their own events." ON "public"."calendar_events" FOR
SELECT USING (can_access_owner_data(user_id));
CREATE POLICY "Users can delete their own events." ON "public"."calendar_events" FOR DELETE USING (can_access_owner_data(user_id));