import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only run these tests if we have credentials for a real instance
const runRlsTests = !!anonKey;

describe.runIf(runRlsTests)('Row Level Security (RLS) Rules for DoS Portal', () => {
  let supabase;

  beforeAll(() => {
    supabase = createClient(url, anonKey);
  });

  it('blocks anonymous access to syllabus_coverage_snapshots', async () => {
    const { data, error } = await supabase.from('syllabus_coverage_snapshots').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to exam_papers', async () => {
    const { data, error } = await supabase.from('exam_papers').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to lesson_observations', async () => {
    const { data, error } = await supabase.from('lesson_observations').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('blocks anonymous access to approval_queue', async () => {
    const { data, error } = await supabase.from('approval_queue').select('*').limit(1);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });
});
