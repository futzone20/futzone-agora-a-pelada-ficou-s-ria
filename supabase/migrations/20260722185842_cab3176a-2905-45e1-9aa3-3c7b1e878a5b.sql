create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'encerrar-peladas-vencidas',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://ueihfrbmefmihtbidloq.supabase.co/functions/v1/encerrar-peladas-vencidas',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);