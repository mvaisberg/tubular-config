-- Estabilidad laboral leída del CV: alta / media / baja (null = sin analizar).
alter table job_applications
  add column if not exists job_stability text
  check (job_stability in ('alta','media','baja'));
