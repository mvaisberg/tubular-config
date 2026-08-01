-- Número de pedido auto-incremental TUB-XXXX (4+ dígitos)
-- Sequence + columna integer único. El prefijo "TUB-" lo agrega el front al mostrar.

CREATE SEQUENCE IF NOT EXISTS public.admin_orders_number_seq START 1;

ALTER TABLE public.admin_orders
    ADD COLUMN IF NOT EXISTS order_number INTEGER UNIQUE;

-- Backfill cronológico para órdenes existentes que no tienen número.
DO $$
DECLARE
    r RECORD;
    n INTEGER := 0;
BEGIN
    -- Si ya hay órdenes con número, arrancamos desde el max + 1
    SELECT COALESCE(MAX(order_number), 0) INTO n FROM public.admin_orders;
    IF n > 0 THEN
        PERFORM setval('public.admin_orders_number_seq', n);
    END IF;

    FOR r IN
        SELECT id FROM public.admin_orders
        WHERE order_number IS NULL
        ORDER BY created_at ASC
    LOOP
        UPDATE public.admin_orders
           SET order_number = nextval('public.admin_orders_number_seq')
         WHERE id = r.id;
    END LOOP;
END $$;

-- Para órdenes nuevas: default = nextval
ALTER TABLE public.admin_orders
    ALTER COLUMN order_number SET DEFAULT nextval('public.admin_orders_number_seq');

ALTER TABLE public.admin_orders
    ALTER COLUMN order_number SET NOT NULL;

CREATE INDEX IF NOT EXISTS admin_orders_number_idx ON public.admin_orders(order_number DESC);
