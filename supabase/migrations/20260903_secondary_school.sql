-- Secundario según el CV: completo / en_curso / incompleto (null = sin datos).
alter table job_applications
  add column if not exists secondary_school text
  check (secondary_school in ('completo','en_curso','incompleto'));
