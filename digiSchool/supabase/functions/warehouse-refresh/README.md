# warehouse-refresh edge function

Refreshes the `warehouse.*` fact tables for the caller's school, then rolls
the platform-wide anonymised `benchmarks_daily` for today.

Called by:
- The Benchmark card on the DoS / Academics dashboards, via
  `supabase.functions.invoke('warehouse-refresh')`.
- A Supabase cron for nightly platform-wide refresh (recommended).

## Deploy

```bash
supabase functions deploy warehouse-refresh --project-ref <PROJECT_REF>
```

No custom secrets. It uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` which Supabase provides to every function
automatically.

## Auth model

- Caller must have a valid session JWT (Authorization header).
- Caller's `profiles.role` must be one of `principal`, `deputy_admin`,
  `deputy_academic`, `dos`. Any other role → 403.
- The function then calls `warehouse.refresh_school` and
  `warehouse.refresh_benchmarks` using the **service role**, because those
  functions are `SECURITY DEFINER` and `EXECUTE` is granted only to
  `service_role`. This keeps writes off the wire — no user can call the
  refresh RPCs directly from the browser.

## Nightly cron (recommended)

In the Supabase dashboard → Database → Cron:

```sql
select cron.schedule(
  'warehouse-nightly',
  '0 2 * * *',  -- 2am server time
  $$
    select net.http_post(
      url := 'https://<PROJECT_REF>.functions.supabase.co/warehouse-refresh',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('warehouse.cron_service_key'),
        'content-type', 'application/json'
      ),
      body := jsonb_build_object('days_back', 7)
    );
  $$
);
```

Set `warehouse.cron_service_key` to your service-role JWT once in the
database settings. The nightly run keeps `school_daily` and
`benchmarks_daily` fresh with 1-day lag; on-demand refresh from the UI
handles same-day recomputes.
