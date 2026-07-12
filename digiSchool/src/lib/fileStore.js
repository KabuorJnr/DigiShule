/**
 * fileStore.js — Supabase Storage backend for PDFs (multi-tenant edition).
 *
 * Storage paths: {school_id}/{type}/{file_id}.pdf
 * This ensures RLS on storage.objects isolates files per school.
 *
 * Metadata table: file_metadata (with school_id column)
 * RLS on file_metadata automatically scopes reads/writes to the current school.
 */

import { supabase } from './supabaseClient';
import { getActiveSchoolId } from './api';

const BUCKET = 'eduone-files';

/** Upload a File object to Supabase Storage and save metadata to DB. */
export async function saveFile({ id, file, type, subject, targetClass, description, dueDate, uploadedBy }) {
  const schoolId = getActiveSchoolId();
  const ext = file.name.split('.').pop();
  // Path format: {school_id}/{type}/{id}.ext — matches storage RLS policy
  const storagePath = `${schoolId}/${type}/${id}.${ext}`;

  // 1. Upload the actual file
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  // 2. Persist metadata with school_id
  const { error: dbErr } = await supabase.from('file_metadata').upsert({
    id,
    name: file.name,
    storage_path: storagePath,
    type,
    subject: subject || 'General',
    target_class: targetClass || 'All Classes',
    description: description || '',
    due_date: dueDate || null,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
    school_id: schoolId,
  });
  if (dbErr) throw new Error(`Metadata save failed: ${dbErr.message}`);

  return storagePath;
}

/** List files by type (and optionally subject). Explicit school_id filter + RLS. */
export async function listFiles(type, subject) {
  const schoolId = getActiveSchoolId();
  let query = supabase.from('file_metadata').select('*').order('uploaded_at', { ascending: false });
  if (schoolId) query = query.eq('school_id', schoolId);
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

/** Get a public URL for a file (useful for images that don't need strict access control for rendering, though signedUrl is better for private files).
 * However, since our bucket might be private, we will use createSignedUrl with a long expiry for rendering, OR just return a public URL if the bucket is public.
 * For gallery images, we will use getSignedUrl or standard publicUrl if configured. Let's use getSignedUrl for now with long expiry, or publicUrl if it works.
 */
export async function getPublicUrl(storagePath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
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

/** Upload a student document (like an admission letter) directly without saving to file_metadata. */
export async function uploadStudentDocument(studentId, file) {
  const schoolId = getActiveSchoolId();
  const ext = file.name.split('.').pop();
  // Using 'student_docs' as the 'type' folder within the bucket.
  // The path must match {school_id}/student_docs/... to satisfy RLS.
  const storagePath = `${schoolId}/student_docs/${studentId}_${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: true });

  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  return storagePath;
}
