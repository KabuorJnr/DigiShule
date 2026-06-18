/**
 * fileStore.js — Supabase Storage backend for PDFs.
 *
 * Storage bucket : eduone-files  (create via Supabase Dashboard → Storage)
 *   Bucket policy: authenticated users can INSERT/SELECT; teachers own their uploads.
 *
 * Metadata table : file_metadata  (see SQL below)
 *   CREATE TABLE IF NOT EXISTS file_metadata (
 *     id          TEXT PRIMARY KEY,
 *     name        TEXT NOT NULL,
 *     storage_path TEXT NOT NULL,
 *     type        TEXT NOT NULL,          -- 'assignments' | 'materials'
 *     subject     TEXT NOT NULL,
 *     target_class TEXT,
 *     description TEXT,
 *     due_date    TEXT,
 *     uploaded_by TEXT NOT NULL,
 *     uploaded_at TIMESTAMPTZ DEFAULT now()
 *   );
 *   ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "all read" ON file_metadata FOR SELECT USING (true);
 *   CREATE POLICY "auth insert" ON file_metadata FOR INSERT WITH CHECK (auth.role() = 'authenticated');
 *   CREATE POLICY "auth delete" ON file_metadata FOR DELETE USING (auth.role() = 'authenticated');
 */

import { supabase } from './supabaseClient';

const BUCKET = 'eduone-files';

/** Upload a File object to Supabase Storage and save metadata to DB. */
export async function saveFile({ id, file, type, subject, targetClass, description, dueDate, uploadedBy }) {
  const ext = file.name.split('.').pop();
  const storagePath = `${type}/${id}.${ext}`;

  // 1. Upload the actual file
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  // 2. Persist metadata
  const { error: dbErr } = await supabase.from('file_metadata').upsert({
    id,
    name: file.name,
    storage_path: storagePath,
    type,
    subject,
    target_class: targetClass || 'All Classes',
    description: description || '',
    due_date: dueDate || null,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
  });
  if (dbErr) throw new Error(`Metadata save failed: ${dbErr.message}`);

  return storagePath;
}

/** List files by type (and optionally subject) from the metadata table. */
export async function listFiles(type, subject) {
  let query = supabase.from('file_metadata').select('*').order('uploaded_at', { ascending: false });
  if (type) query = query.eq('type', type);
  if (subject && subject !== 'All') query = query.eq('subject', subject);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/** Get a signed URL (valid 60 min) for a file — used to open/download. */
export async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Delete a file from Storage and its metadata row. */
export async function deleteFile(id, storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from('file_metadata').delete().eq('id', id);
}

/** Open PDF in a new browser tab via signed URL. */
export async function openFilePDF(storagePath) {
  const url = await getSignedUrl(storagePath);
  window.open(url, '_blank');
}

/** Trigger a file download via signed URL. */
export async function downloadFilePDF(storagePath, name) {
  const url = await getSignedUrl(storagePath);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'file.pdf';
  a.click();
}
