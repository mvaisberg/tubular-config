-- Postulaciones laborales (formulario público /trabaja).
create table if not exists job_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  whatsapp text not null,
  birth_year int,
  location text,               -- barrio + tiempo de viaje
  available_schedule boolean,  -- L-V 9-18 + sáb 9-13
  physical_ok boolean,
  drivers_license text,        -- auto / moto / ambos / no
  experience text,
  strengths text,
  salary_expectation text,
  start_date text,
  cv_path text,                -- ruta en storage (bucket cvs)
  utm_source text, utm_medium text, utm_campaign text,
  status text not null default 'new'
    check (status in ('new','shortlisted','interviewed','hired','discarded')),
  admin_notes text
);
alter table job_applications enable row level security;
-- Solo lectura/escritura vía service role (API); admins leen por API.

create policy "job apps admin read" on job_applications for select
  using (exists (select 1 from profiles where user_id = auth.uid() and role = 'admin'));
create policy "job apps admin update" on job_applications for update
  using (exists (select 1 from profiles where user_id = auth.uid() and role = 'admin'));
