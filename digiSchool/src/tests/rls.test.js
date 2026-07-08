import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only run these tests if we have credentials for a real instance
const runRlsTests = !!anonKey;

describe.runIf(runRlsTests)('Row Level Security (RLS) Rules', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(url, anonKey);
  });

  it('blocks anonymous access to invoices', async () => {
    const { data, error } = await supabase.from('invoices').select('*').limit(1);
    // Since RLS is enabled and there's no auth session, this should return empty array
    // (RLS policies use `my_school_ids()` which relies on `auth.uid()`)
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to expenses', async () => {
    const { data, error } = await supabase.from('expenses').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to profiles', async () => {
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to lesson_plans', async () => {
    const { data, error } = await supabase.from('lesson_plans').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to schemes_of_work', async () => {
    const { data, error } = await supabase.from('schemes_of_work').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  // To truly test cross-tenant isolation, we would need to authenticate as a specific user,
  // insert a record for school A, and ensure a user from school B cannot read it.
  // This baseline ensures the default deny is active for unauthenticated requests.
});
