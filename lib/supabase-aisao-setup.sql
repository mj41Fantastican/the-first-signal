-- Run this in Supabase SQL Editor
-- Adds Ai's Ao editorial segment columns to stories table

ALTER TABLE stories ADD COLUMN IF NOT EXISTS segment TEXT;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS edition_day TEXT;
