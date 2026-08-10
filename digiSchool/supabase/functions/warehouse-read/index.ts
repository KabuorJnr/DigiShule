import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

    // (b) Look up profile: get school_id
    const { data: profile, error: profErr } = await userClient
      .from('profiles')
      .select('school_id, role')
      .eq('id', user.id)
      .maybeSingle()
    if (profErr || !profile) return json({ error: 'no_profile' }, 403)
    if (!profile.school_id) return json({ error: 'no_school' }, 400)

    // (c) Read from warehouse using service role
    if (!serviceRoleKey) return json({ error: 'not_configured' }, 503)
    const svc = createClient(supabaseUrl, serviceRoleKey)

    const body = await req.json().catch(() => ({}))
    const { target, days_back } = body;
    
    let result = null;

    if (target === 'school_daily') {
      const cap = Math.min(Math.max(Number(days_back) || 30, 1), 180)
      const fromDate = new Date(Date.now() - (cap - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      
      const { data, error } = await svc.schema('warehouse').from('school_daily')
        .select('*')
        .eq('school_id', profile.school_id)
        .gte('date', fromDate)
        .order('date', { ascending: true })
      if (error) throw error
      result = data
    } 
    else if (target === 'class_term') {
      const { data, error } = await svc.schema('warehouse').from('class_term')
        .select('*')
        .eq('school_id', profile.school_id)
        .order('class', { ascending: true })
      if (error) throw error
      result = data
    } 
    else if (target === 'teacher_term') {
      const { data, error } = await svc.schema('warehouse').from('teacher_term')
        .select('*')
        .eq('school_id', profile.school_id)
      if (error) throw error
      result = data
    } 
    else if (target === 'benchmarks_daily') {
      // Platform-wide anonymized benchmarks
      const { data, error } = await svc.schema('warehouse').from('benchmarks_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(1)
      if (error) throw error
      result = data
    } 
    else {
      return json({ error: 'invalid_target' }, 400)
    }

    return json({ ok: true, data: result || [] })
  } catch (e) {
    return json({ error: 'internal', message: e.message }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
