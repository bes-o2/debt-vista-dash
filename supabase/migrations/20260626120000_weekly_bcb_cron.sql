-- Weekly BCB rates refresh (Thursdays 11:00 UTC / 08:00 BRT).
-- Pulls CDI/SELIC/IPCA/IGPM from the BCB SGS API into economic_indices so
-- post-fixed debts can be repriced with up-to-date realized data.
--
-- Auth: uses the project's PUBLISHABLE (anon) key, which is public by design
-- (it ships in the browser bundle). The edge function itself writes with the
-- service-role key from its own env, so the anon key only needs to pass the
-- function's verify_jwt gate.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Make the migration re-runnable: drop a previous job with the same name.
do $$
begin
  perform cron.unschedule('weekly-bcb-fetch');
exception
  when others then null;
end $$;

select cron.schedule(
  'weekly-bcb-fetch',
  '0 11 * * 4',
  $job$
  select net.http_post(
    url := 'https://objvdyjnryvllvadglns.supabase.co/functions/v1/fetch-bcb-rates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ianZkeWpucnl2bGx2YWRnbG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTg1MzEsImV4cCI6MjA5MTg3NDUzMX0.nGV0WuwtTyEoEn-nQs2TtwjiKTCEi82ldlBtOPQ4rN0',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ianZkeWpucnl2bGx2YWRnbG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyOTg1MzEsImV4cCI6MjA5MTg3NDUzMX0.nGV0WuwtTyEoEn-nQs2TtwjiKTCEi82ldlBtOPQ4rN0'
    ),
    body := jsonb_build_object('forceUpdate', true, 'daysBack', 30)
  );
  $job$
);
