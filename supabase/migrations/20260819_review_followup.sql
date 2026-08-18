-- Plantilla del segundo intento de pedido de review (para no-respondedores).
alter table settings add column if not exists reviews_followup_template_name text;
update settings set reviews_followup_template_name = coalesce(reviews_followup_template_name, 'review_pablo_2') where id = 1;

-- Nuevo kind de job para el segundo intento.
alter table wa_outbound_jobs drop constraint wa_outbound_jobs_kind_check;
alter table wa_outbound_jobs add constraint wa_outbound_jobs_kind_check
  check (kind = any (array['abandoned_cart'::text, 'review_request'::text, 'review_followup'::text]));
