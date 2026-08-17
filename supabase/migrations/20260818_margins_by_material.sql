-- Márgenes objetivo separados por material (acero / acrílico).
-- target_margin_percent queda como fallback legacy.
alter table settings add column if not exists margin_steel_percent numeric;
alter table settings add column if not exists margin_acrylic_percent numeric;

update settings
set margin_steel_percent   = coalesce(margin_steel_percent, target_margin_percent, 70),
    margin_acrylic_percent = coalesce(margin_acrylic_percent, target_margin_percent, 70)
where id = 1;
