// EduOne — AI Weekly Brief edge function.
//
// One endpoint that all portals talk to for AI-generated content. The client
// sends a `kind` (which portal / feature) and a set of already-aggregated
// metrics. The server crafts the right prompt for that kind and returns a
// tight, structured JSON payload.
//
// Why aggregate client-side? Because the client already has the data loaded
// for the current user's role (RLS-scoped). Server-side aggregation would
// duplicate that work and require the function to have service-role access.
// We keep the boundary narrow: the server only sees numbers, never PII.
//
// Auth: requires a valid Supabase session JWT (Authorization header). The
// function verifies it before calling Anthropic. No JWT → no LLM call.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = 'claude-haiku-4-5-20251001' // cheapest capable Claude; upgrade if needed
const MAX_TOKENS = 900

// ── System prompts per feature ────────────────────────────────────────────
// Each returns strict JSON so the client can render deterministically.
const SYSTEM_PROMPTS: Record<string, string> = {
  principal_weekly: `You are the Chief-of-Staff for a Kenyan secondary school principal.
You will be given a JSON payload of the school's last-week metrics. Your job is to
identify the THREE most important things the principal should notice this week and
return them as JSON.

Rules:
- Be blunt and specific. Cite the actual numbers you were given.
- Prefer things that changed or moved. A stable metric is not news.
- If a metric worsened, name it as a problem. Do not sugarcoat.
- Do not invent metrics that weren't in the input.
- Each suggested_action should be a single concrete step, doable this week.
- Tone: professional, calm, direct. No exclamation marks. No emojis.

Output strictly this JSON, and nothing else:
{
  "items": [
    { "title": "short label (<= 60 chars)", "why_it_matters": "1-2 sentences citing the numbers", "suggested_action": "one concrete step" },
    ...three items total
  ]
}`,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth: require a valid Supabase session ───────────────────────────
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '').trim()
    if (!jwt) return json({ error: 'missing_auth' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return json({ error: 'invalid_auth' }, 401)

    // ── Resolve the AI key using the SAME pattern as finance:
    //     1. Look up the caller's school_id from their profile.
    //     2. Pull the school's own key from school_ai_credentials (service role).
    //     3. Fall back to a platform-wide ANTHROPIC_API_KEY env if the school
    //        hasn't set their own yet.
    //     School admins manage this in-app; nobody has to run
    //     `supabase secrets set`.
    let anthropicKey = ''
    let providerModelOverride = ''

    if (serviceRoleKey) {
      const svc = createClient(supabaseUrl, serviceRoleKey)
      const { data: profile } = await svc.from('profiles').select('school_id').eq('id', user.id).maybeSingle()
      if (profile?.school_id) {
        const { data: creds } = await svc.from('school_ai_credentials')
          .select('api_key, provider, model_override')
          .eq('school_id', profile.school_id)
          .maybeSingle()
        if (creds?.api_key && (!creds.provider || creds.provider === 'anthropic')) {
          anthropicKey = creds.api_key.trim()
          providerModelOverride = (creds.model_override || '').trim()
        }
      }
    }
    // Platform fallback for early-stage single-tenant use.
    if (!anthropicKey) anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') || ''
    if (!anthropicKey) return json({ error: 'ai_not_configured' }, 503)

    const body = await req.json().catch(() => ({}))
    const { kind = 'principal_weekly', payload = {}, school_name = 'the school' } = body || {}
    const system = SYSTEM_PROMPTS[kind]
    if (!system) return json({ error: 'unknown_kind', kind }, 400)

    // Compose the user message: the concrete data + a short instruction.
    const userMessage = [
      `School: ${school_name}`,
      `Metrics (JSON):`,
      JSON.stringify(payload, null, 2),
      '',
      'Return the JSON described in your instructions. Do not include any text outside the JSON.',
    ].join('\n')

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: providerModelOverride || MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      return json({ error: 'ai_upstream', status: aiRes.status, detail: errText.slice(0, 500) }, 502)
    }

    const aiJson = await aiRes.json()
    const text = aiJson?.content?.[0]?.text?.trim() || ''

    // Parse the strict-JSON response. If Claude drifts (rare with a good
    // system prompt), we return the raw text so the client can decide.
    let parsed: unknown = null
    try {
      // Tolerate a stray code fence.
      const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      parsed = JSON.parse(clean)
    } catch { /* leave parsed null, return raw */ }

    return json({
      kind,
      model: MODEL,
      parsed,
      raw: parsed ? undefined : text,
      usage: aiJson?.usage,
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
