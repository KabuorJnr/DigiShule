# Supabase Storage Setup for EduOne File Uploads

## 1. Create the Storage Bucket

In your Supabase project dashboard:

1. Go to **Storage** → click **New bucket**
2. Name it exactly: `eduone-files`
3. Set to **Private** (we use signed URLs for access control)
4. Click **Create bucket**

## 2. Create the Metadata Table

Go to **SQL Editor** and run:

```sql
-- File metadata table
CREATE TABLE IF NOT EXISTS file_metadata (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  type          TEXT NOT NULL,          -- 'assignments' | 'materials'
  subject       TEXT NOT NULL,
  target_class  TEXT,
  description   TEXT,
  due_date      TEXT,
  uploaded_by   TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read file metadata
CREATE POLICY "all read file_metadata"
  ON file_metadata FOR SELECT
  USING (true);

-- Only authenticated users can insert
CREATE POLICY "auth insert file_metadata"
  ON file_metadata FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can delete
CREATE POLICY "auth delete file_metadata"
  ON file_metadata FOR DELETE
  USING (auth.role() = 'authenticated');
```

## 3. Set Storage Bucket Policies

Go to **Storage** → `eduone-files` → **Policies** → Add the following:

### SELECT (download) policy:
```sql
-- Allow authenticated users to read files
CREATE POLICY "read eduone-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'eduone-files' AND auth.role() = 'authenticated');
```

### INSERT (upload) policy:
```sql
-- Allow authenticated users to upload
CREATE POLICY "insert eduone-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'eduone-files' AND auth.role() = 'authenticated');
```

### DELETE policy:
```sql
-- Allow authenticated users to delete
CREATE POLICY "delete eduone-files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'eduone-files' AND auth.role() = 'authenticated');
```

## 4. Environment Variables

Your `.env` file should already have:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 5. How It Works

| Action | Who | Where stored |
|---|---|---|
| Teacher uploads PDF | Teacher Portal → Assignments & Materials | `eduone-files` bucket at path `assignments/file_xxx.pdf` |
| Metadata saved | Automatically | `file_metadata` table |
| Student views file | Student Portal → Resources → Downloads | Signed URL (60 min expiry) generated from Supabase |
| Student downloads file | Same | Signed URL → forced download |

## File Size Limit
- Current limit: **20 MB** per file (enforced in TeacherResources.jsx)
- Supabase Storage default limit: **50 MB** per file (Pro plan: up to 5 GB)
