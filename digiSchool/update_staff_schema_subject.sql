-- Run this in your Supabase SQL Editor to ensure all recent tables have the subject column

ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS subject TEXT;
