-- Orden manual de la columna de finalistas (1 = mejor).
alter table job_applications add column if not exists finalist_rank int;
