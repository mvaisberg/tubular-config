-- Base de colaboradores: gente que quiere trabajar con Tubular o hacer
-- contenido/canje. Se completa desde /sumate (público) y se revisa en el manager.
create table if not exists collaborators (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('trabajo','contenido')),
  full_name text not null,
  whatsapp text not null,
  email text,
  location text,
  -- Camino "quiero trabajar"
  areas text[],              -- producción, depósito, ventas, diseño, marketing, admin
  experience text,
  cv_path text,              -- bucket cvs
  -- Camino "contenido y canje"
  instagram text,
  tiktok text,
  followers text,
  content_type text,
  portfolio_url text,
  proposal text,             -- qué propone / por qué le interesa
  -- Gestión
  status text not null default 'new'
    check (status in ('new','contacted','interested','archived')),
  admin_notes text,
  utm_source text, utm_medium text, utm_campaign text
);
create index if not exists collaborators_type_idx on collaborators (type, created_at desc);
alter table collaborators enable row level security;

create policy "collab admin read" on collaborators for select
  using (exists (select 1 from profiles where user_id = auth.uid() and role = 'admin'));
create policy "collab admin update" on collaborators for update
  using (exists (select 1 from profiles where user_id = auth.uid() and role = 'admin'));
