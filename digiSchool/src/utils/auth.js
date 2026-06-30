import { supabase } from '../lib/supabaseClient';

export function generateSecurePassword(length = 10) {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export async function provisionAccount({ email, username, password, name, role, schoolName }) {
  // Call the Vercel API
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password, name, role, schoolName })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error || 'Failed to send email');
  }
  return await res.json();
}

export async function generateSequentialUsername(prefix) {
  // Generate a random 5-digit number to ensure uniqueness and bypass RLS query blocks
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomNum}`;
}

