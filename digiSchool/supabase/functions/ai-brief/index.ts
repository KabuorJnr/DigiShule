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

// Default models for each provider. Cheapest capable in each family.
const DEFAULT_MODELS = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
}
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
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt)
    if (userErr || !user) return json({ error: 'invalid_auth', details: userErr?.message }, 401)

    // ── Resolve the AI provider + key using the SAME pattern as finance:
    //     1. Look up caller's school → pull per-school row from
    //        school_ai_credentials (readable only by service_role).
    //     2. Fall back to platform-wide env keys if the school hasn't set
    //        one yet — supports both OPENAI_KEY (their naming) and the
    //        canonical *_API_KEY names.
    //     3. Auto-pick provider: prefer whatever key we actually have.
    let provider: 'anthropic' | 'openai' = 'anthropic'
    let apiKey = ''
    let providerModelOverride = ''

    if (serviceRoleKey) {
      const svc = createClient(supabaseUrl, serviceRoleKey)
      const { data: profile } = await svc.from('profiles').select('school_id').eq('id', user.id).maybeSingle()
      if (profile?.school_id) {
        const { data: creds } = await svc.from('school_ai_credentials')
          .select('api_key, provider, model_override')
          .eq('school_id', profile.school_id)
          .maybeSingle()
        if (creds?.api_key) {
          apiKey = creds.api_key.trim()
          provider = (creds.provider === 'openai') ? 'openai' : 'anthropic'
          providerModelOverride = (creds.model_override || '').trim()
        }
      }
    }

    // Platform fallback. Try OpenAI first if OPENAI_KEY / OPENAI_API_KEY is
    // set (matches the user's .env naming), otherwise Anthropic.
    if (!apiKey) {
      const openaiKey = (Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_KEY') || '').trim()
      const anthropicKey = (Deno.env.get('ANTHROPIC_API_KEY') || '').trim()
      const eduoneKey = (Deno.env.get('EDUONE_KEY') || '').trim()
      
      if (openaiKey) { apiKey = openaiKey; provider = 'openai' }
      else if (anthropicKey) { apiKey = anthropicKey; provider = 'anthropic' }
      else if (eduoneKey) { apiKey = eduoneKey; provider = 'gemini' }
    }

    if (!apiKey) return json({ error: 'ai_not_configured' }, 503)
    let model = providerModelOverride || DEFAULT_MODELS[provider] || ''
    let baseUrl = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : ''

    if (provider === 'custom') {
      const parts = model.split('|')
      model = parts[0]
      baseUrl = parts.length > 1 ? parts[1] : 'https://api.openai.com/v1/chat/completions'
      provider = 'openai' // Custom uses OpenAI SDK/format
    }

    const body = await req.json().catch(() => ({}))
    const { kind = 'principal_weekly', payload = {}, school_name = 'the school' } = body || {}
    const prompt = SYSTEM_PROMPTS[kind]
    const metrics = payload
    if (!prompt) return json({ error: 'unknown_kind', kind }, 400)

    // ── Provider dispatch ────────────────────────────────────────────────
    let aiRes: Response
    if (provider === 'openai') {
      aiRes = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'School: ' + school_name + '\nMetrics:\n' + JSON.stringify(metrics) },
          ],
        }),
      })
    } else if (provider === 'gemini') {
      const geminiMessages = [{ role: 'user', parts: [{ text: 'School: ' + school_name + '\nMetrics:\n' + JSON.stringify(metrics) }] }]
      
      const payload: any = { 
        contents: geminiMessages, 
        systemInstruction: { parts: [{ text: prompt }] },
        generationConfig: { maxOutputTokens: MAX_TOKENS, responseMimeType: 'application/json' } 
      }

      aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
      })
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      return json({ error: 'ai_upstream', provider, status: aiRes.status, detail: errText.slice(0, 500) }, 502)
    }

    const aiJson = await aiRes.json()
    let text = ''
    if (provider === 'openai') {
      text = aiJson?.choices?.[0]?.message?.content || ''
    } else if (provider === 'gemini') {
      text = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else {
      text = aiJson?.content?.[0]?.text || ''
    }
    text = text.trim()

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
      provider,
      model,
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
