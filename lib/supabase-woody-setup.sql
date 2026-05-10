-- Run this in Supabase SQL Editor to set up the Woody Bernstein feature

-- 1. Create the story_requests table
CREATE TABLE IF NOT EXISTS story_requests (
  id BIGSERIAL PRIMARY KEY,
  topic TEXT NOT NULL,
  description TEXT NOT NULL,
  submitted_by TEXT DEFAULT 'anonymous',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_production', 'published')),
  fast_tracked BOOLEAN DEFAULT FALSE,
  fast_track_amount NUMERIC DEFAULT 0,
  published_story_id BIGINT REFERENCES stories(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE story_requests ENABLE ROW LEVEL SECURITY;

-- 3. Allow public read/insert (same pattern as other tables)
CREATE POLICY "Public can read story_requests"
  ON story_requests FOR SELECT USING (true);

CREATE POLICY "Public can insert story_requests"
  ON story_requests FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can update story_requests"
  ON story_requests FOR UPDATE USING (true);

-- 4. Add Woody Bernstein to agent_config
INSERT INTO agent_config (id, display_name, beat, tone, focus, instructions, active)
VALUES (
  'woody',
  'WOODY BERNSTEIN, Investigative Correspondent',
  'investigative',
  'investigative long-form journalism in the tradition of American newspaper exposés — thorough, fair, evidence-based, and unflinching',
  'deep dives, investigations, exposés, accountability reporting, fact-checking, reader-submitted topics',
  'You are the investigative arm of The First Signal. You take story requests from the community and produce one deep-dive exposé every Sunday. Your reporting follows strict journalistic standards — fair, balanced, and evidence-based. If a fast-tracked topic turns out to be unsubstantiated, you report that finding honestly. You never produce puff pieces regardless of payment.',
  true
)
ON CONFLICT (id) DO NOTHING;
