#!/usr/bin/env node
// EduOne — sync .env secrets to the Supabase project's Edge Function secrets.
//
// Usage:
//   node scripts/sync-supabase-secrets.mjs [--project-ref <ref>] [--file .env]
//   node scripts/sync-supabase-secrets.mjs --dry-run
//
// What it does
//   Reads .env (or the file you pass), filters to the keys that edge functions
//   actually need (AI providers, email, SMS), and pipes them to
//   `supabase secrets set --project-ref <ref>` in one shot.
//
// Why this exists
//   The frontend .env doesn't reach edge functions automatically. This gives
//   you a single command instead of typing `supabase secrets set FOO=…` for
//   every provider key.
//
// Requirements
//   - Supabase CLI installed and logged in (`supabase login`)
//   - `SUPABASE_PROJECT_REF` in .env, OR pass --project-ref
//
// Safety
//   - Never prints secret VALUES; only key names.
//   - Skips VITE_* keys (those belong in the browser, not on the server).
//   - Skips SUPABASE_* env vars (Supabase injects those automatically).

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

const envFile = flag('--file') || '.env';
const dryRun = has('--dry-run');

// Read .env
const envPath = path.resolve(process.cwd(), envFile);
if (!fs.existsSync(envPath)) {
  console.error(`✗ ${envFile} not found at ${envPath}`);
  process.exit(1);
}
const raw = fs.readFileSync(envPath, 'utf8');
const pairs = {};
for (const line of raw.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  // Support "KEY=value" and "KEY = value".
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let [, k, v] = m;
  // Strip surrounding quotes if present.
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  pairs[k] = v;
}

const projectRef = flag('--project-ref') || pairs.SUPABASE_PROJECT_REF;
if (!projectRef && !dryRun) {
  console.error('✗ Missing --project-ref (or set SUPABASE_PROJECT_REF in .env).');
  process.exit(1);
}

// Whitelist of keys that edge functions can use. Add here when a new function
// needs a new secret. Anything else is deliberately not shipped.
const ALLOWED = new Set([
  // AI providers
  'OPENAI_API_KEY', 'OPENAI_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_API_KEY', 'GEMINI_API_KEY',
  // Email
  'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY',
  // SMS
  'AT_API_KEY', 'AT_USERNAME',
  // Payments (already stored per-school in a table for M-Pesa, but a
  // platform fallback is useful during pilots)
  'MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET',
  'KCB_CONSUMER_KEY', 'KCB_CONSUMER_SECRET', 'KCB_API_KEY',
]);

// Alias mapping: if user set OPENAI_KEY, also set OPENAI_API_KEY so the
// edge function can read either canonical name.
const ALIAS = { OPENAI_KEY: 'OPENAI_API_KEY' };

const outbound = {};
for (const [k, v] of Object.entries(pairs)) {
  if (k.startsWith('VITE_') || k.startsWith('SUPABASE_')) continue;
  if (!ALLOWED.has(k)) continue;
  if (!v) continue;
  outbound[k] = v;
  if (ALIAS[k]) outbound[ALIAS[k]] = v;
}

const keys = Object.keys(outbound);
if (keys.length === 0) {
  console.log('No AI/email/SMS keys found in .env. Nothing to sync.');
  process.exit(0);
}

console.log(`Would push ${keys.length} secret${keys.length === 1 ? '' : 's'} to Supabase project ${projectRef || '<not set>'}:`);
for (const k of keys) console.log(`  · ${k}`);
if (dryRun) {
  console.log('\n(dry-run — no changes made)');
  process.exit(0);
}

// Build the args: `supabase secrets set KEY1=v1 KEY2=v2 ...`
// We DO NOT print values.
const cliArgs = ['secrets', 'set', '--project-ref', projectRef, ...keys.map(k => `${k}=${outbound[k]}`)];
const res = spawnSync('supabase', cliArgs, { stdio: ['inherit', 'inherit', 'inherit'] });
if (res.status !== 0) {
  console.error('\n✗ supabase CLI exited with', res.status);
  console.error('  Make sure the Supabase CLI is installed and you\'re logged in: supabase login');
  process.exit(res.status || 1);
}
console.log('\n✓ Secrets pushed. Redeploy your functions if they need to reload env.');
