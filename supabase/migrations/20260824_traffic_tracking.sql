-- Tracking de uso real del configurador: UTMs, interacciones, duración.
alter table configurator_sessions
  add column if not exists session_key text unique,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists landing text,
  add column if not exists interactions int not null default 0,
  add column if not exists engaged_at timestamptz,
  add column if not exists duration_seconds int,
  add column if not exists last_event text,
  add column if not exists shared boolean not null default false,
  add column if not exists added_to_cart boolean not null default false,
  add column if not exists last_price numeric;

create index if not exists configurator_sessions_created_idx on configurator_sessions (created_at);

-- Suma un evento a la sesión (contador atómico + flags).
create or replace function track_config_event(p_key text, p_event text, p_price numeric default null)
returns void language sql as $$
  update configurator_sessions set
    interactions = interactions + 1,
    engaged_at = coalesce(engaged_at, now()),
    last_event = p_event,
    shared = shared or p_event = 'share_design',
    added_to_cart = added_to_cart or p_event = 'add_to_cart',
    last_price = coalesce(p_price, last_price)
  where session_key = p_key;
$$;
