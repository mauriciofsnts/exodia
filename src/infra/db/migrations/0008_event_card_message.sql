-- Track the channel message posted for an event's reminder so the "starting
-- now" ping can edit it in place instead of posting a second message.
ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS card_channel_id TEXT;
ALTER TABLE guild_events ADD COLUMN IF NOT EXISTS card_message_id TEXT;
