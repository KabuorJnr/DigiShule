// EduOne — warehouse-refresh edge function.
//
// Triggers `warehouse.refresh_school()` for the caller's school, and then
// `warehouse.refresh_benchmarks()` for today. Admin-only.
//
// Called from the client via supabase.functions.invoke('warehouse-refresh').
// Also safe to call from a Supabase cron for nightly refresh across all
// schools (in that case, invoke with { all: true } and a service-role JWT).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ADMIN_ROLES = ['principal', 'deputy_admin', 'deputy_academic', 'dos']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) return json({ error: 'missing_auth' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    // (a) Auth check with the caller's JWT.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser(jwt)
    if (userErr || !user) return json({ error: 'invalid_auth', details: userErr?.message }, 401)

    // (b) Look up profile: get school_id + role. Enforce admin-only.
    const { data: profile, error: profErr } = await userClient
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (profErr || !profile) return json({ error: 'no_profile' }, 403)
    if (!ADMIN_ROLES.includes(profile.role)) return json({ error: 'admin_only', role: profile.role }, 403)
    if (!profile.school_id) return json({ error: 'no_school' }, 400)

    // (c) Refresh using service role (only path with EXECUTE on the functions).
    if (!serviceRoleKey) return json({ error: 'not_configured' }, 503)
    const svc = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => ({}))
    const daysBack = Math.min(Math.max(Number(body?.days_back) || 30, 1), 180)

    const t0 = Date.now()
    const { error: e1 } = await svc.rpc('refresh_school', {
      p_school_id: profile.school_id,
      p_up_to: new Date().toISOString().slice(0, 10),
      p_days_back: daysBack,
    }, { get: false })
    // The RPC lives in the `warehouse` schema, so we route via the schema arg.
    // supabase-js v2 supports schema selection via .schema('warehouse'):
    if (e1) {
      const { error: e2 } = await svc.schema('warehouse').rpc('refresh_school', {
        p_school_id: profile.school_id,
        p_up_to: new Date().toISOString().slice(0, 10),
        p_days_back: daysBack,
      })
      if (e2) return json({ error: 'refresh_failed', detail: e2.message }, 500)
    }

    // Benchmarks (platform-wide) — errors here are non-fatal, the school
    // refresh is what the caller asked for.
    try {
      await svc.schema('warehouse').rpc('refresh_benchmarks', {
        p_date: new Date().toISOString().slice(0, 10),
      })
    } catch { /* non-fatal */ }

    return json({
      ok: true,
      school_id: profile.school_id,
      days_back: daysBack,
      duration_ms: Date.now() - t0,
    })
  } catch (e) {
    return json({ error: 'internal', message: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
