ALTER TABLE public.admin_orders
    ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'low'
    CHECK (priority IN ('low', 'medium', 'high'));

CREATE INDEX IF NOT EXISTS admin_orders_priority_idx ON public.admin_orders(priority);
