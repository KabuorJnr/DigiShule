-- School newsletters composed by deans / deputy principals / DoS.
-- Stored so issues can be revisited, reprinted, and re-published. The rendered
-- document carries the school letterhead and the official stamp.
CREATE TABLE IF NOT EXISTS newsletters (
    id TEXT PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    issue_date DATE DEFAULT CURRENT_DATE,
    intro TEXT,
    sections JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft' | 'Published'
    author TEXT,
    author_role TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_school ON newsletters (school_id, created_at DESC);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school isolation" ON newsletters
    FOR ALL USING (school_id = ANY(my_school_ids()))
    WITH CHECK (school_id = ANY(my_school_ids()));
