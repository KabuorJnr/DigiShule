# ai-brief edge function

The single AI endpoint used by every EduOne portal. Client sends `{ kind, payload }`;
the function crafts the right prompt for `kind` and returns strict JSON.

## Deploy

```bash
supabase functions deploy ai-brief --project-ref <PROJECT_REF>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <PROJECT_REF>
```

## Environment

- `ANTHROPIC_API_KEY` (required) — your Anthropic API key. Get one at
  <https://console.anthropic.com>.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — auto-provided by Supabase to the function.

## Supported `kind` values

- `principal_weekly` — 3-item briefing for the Principal / DoS dashboard.

Add more by extending `SYSTEM_PROMPTS` in `index.ts`. Each new prompt must
constrain Claude to output strict JSON that the corresponding client
component knows how to render.

## Model & cost

Uses `claude-haiku-4-5-20251001` at `max_tokens: 900`. Typical brief is
~$0.001–$0.003 per generation. Client caches results for 24 hours, so a
school with 50 admin sessions per day still only pays for a handful of
LLM calls per day.

## Auth

Requires a valid Supabase session JWT in the `Authorization` header.
Requests without one are rejected before Anthropic is called. The user's
identity is available inside the function via `supabase.auth.getUser()`.
