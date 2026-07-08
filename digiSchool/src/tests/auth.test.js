import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signInWithUsername, supabase } from '../lib/supabaseClient';

describe('signInWithUsername', () => {
  beforeEach(() => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockClear();
    vi.spyOn(supabase.auth, 'signOut').mockClear();
    vi.spyOn(supabase, 'rpc').mockClear();
    
    // Mock from() chain
    vi.spyOn(supabase, 'from').mockImplementation(() => ({
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'mock' }, error: null }) }) }) })
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires username and password', async () => {
    const res = await signInWithUsername('', 'password');
    expect(res.error).toBeDefined();
    expect(res.error.message).toMatch(/Enter a username and password/i);
  });

  it('signs in directly if username is an email', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
    vi.spyOn(supabase, 'from').mockImplementation(() => ({
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: mockMaybeSingle }) }) })
    }));

    const res = await signInWithUsername('test@example.com', 'password123');
    
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
    expect(res.data).toBeDefined();
  });

  it('looks up email via RPC if username is not an email', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'student@school.com', error: null });
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: { id: 'user-456' } },
      error: null,
    });
    
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-456' }, error: null });
    vi.spyOn(supabase, 'from').mockImplementation(() => ({
      select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: mockMaybeSingle }) }) })
    }));

    const res = await signInWithUsername('STU123', 'password123');
    
    expect(supabase.rpc).toHaveBeenCalledWith('email_for_username', { p_username: 'STU123' });
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@school.com',
      password: 'password123'
    });
    expect(res.data).toBeDefined();
  });
  
  it('returns invalid credentials if RPC fails or no email returned', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: new Error('Not found') });
    
    const res = await signInWithUsername('UNKNOWN', 'password');
    expect(res.error).toBeDefined();
    expect(res.error.message).toMatch(/Invalid username or password/i);
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
