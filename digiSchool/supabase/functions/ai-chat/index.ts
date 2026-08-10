// EduOne — AI Chat edge function.
//
// Generic chat completion endpoint that accepts a list of messages and returns
// the assistant's reply. Uses the same per-school credentials and platform
// fallback logic as ai-brief.
//
// Auth: requires a valid Supabase session JWT (Authorization header).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_MODELS = {
  anthropic: 'claude-3-haiku-20240307',
  openai: 'gpt-4o-mini',
}
const MAX_TOKENS = 1500

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
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
    const { messages = [] } = body || {}
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'invalid_messages' }, 400)
    }

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
          messages,
        }),
      })
    } else if (provider === 'gemini') {
      let system = ''
      const geminiMessages = []
      
      for (const msg of messages) {
        if (msg.role === 'system') system += msg.content + '\n'
        else geminiMessages.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] })
      }
      
      const payload: any = { contents: geminiMessages, generationConfig: { maxOutputTokens: MAX_TOKENS } }
      if (system) payload.systemInstruction = { parts: [{ text: system.trim() }] }

      aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      // For Anthropic, we need to extract the system prompt (if any) and pass it separately
      let system = ''
      const anthropicMessages = []
      
      for (const msg of messages) {
        if (msg.role === 'system') {
          system += msg.content + '\n'
        } else {
          // Map other roles to user/assistant
          const mappedRole = msg.role === 'assistant' ? 'assistant' : 'user'
          anthropicMessages.push({ role: mappedRole, content: msg.content })
        }
      }
      
      const payload: any = {
        model,
        max_tokens: MAX_TOKENS,
        messages: anthropicMessages,
      }
      if (system) payload.system = system.trim()

      aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
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

    return json({
      provider,
      model,
      text,
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
