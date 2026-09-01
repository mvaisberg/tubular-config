-- Días sin respuesta tras los que se dispara el 2º intento de review.
alter table settings add column if not exists reviews_followup_days int;
update settings set reviews_followup_days = coalesce(reviews_followup_days, 7) where id = 1;
