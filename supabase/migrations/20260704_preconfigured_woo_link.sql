-- Vínculo entre una configuración guardada (preconfigured_products) y un
-- producto de WooCommerce, para: piezas del armador en catálogo, verificación
-- de precios y análisis de costos.
ALTER TABLE public.preconfigured_products
    ADD COLUMN IF NOT EXISTS woo_product_id BIGINT;

CREATE INDEX IF NOT EXISTS preconfigured_products_woo_product_id_idx
    ON public.preconfigured_products(woo_product_id);
