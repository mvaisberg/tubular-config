-- Estado de logística del pedido (separado de status de pago)
-- pending -> in_production -> assembled -> packed -> shipped -> delivered

ALTER TABLE public.admin_orders
    ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS admin_orders_fulfillment_status_idx
    ON public.admin_orders(fulfillment_status);
