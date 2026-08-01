-- Módulo de stock: catálogo de items + historial de movimientos.
-- current_quantity en stock_items se mantiene sincronizado por trigger
-- al insertar/eliminar movements.

CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT,                              -- match opcional con parts.sku para auto-consume
    category TEXT,                          -- "chapa", "caño", "conector", "panel", etc.
    unit TEXT NOT NULL DEFAULT 'u',        -- u, m, kg, m², l
    current_quantity NUMERIC NOT NULL DEFAULT 0,
    min_quantity NUMERIC DEFAULT 0,        -- umbral para alerta de stock bajo
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_items_sku_idx ON public.stock_items(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_items_category_idx ON public.stock_items(category);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL,             -- positivo = entrada, negativo = salida
    reason TEXT NOT NULL DEFAULT 'manual', -- entrada, consumo_pedido, ajuste, devolucion, manual
    order_id UUID REFERENCES public.admin_orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON public.stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS stock_movements_order_idx ON public.stock_movements(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON public.stock_movements(created_at DESC);

-- Mantener current_quantity sincronizado con la suma de movements.
CREATE OR REPLACE FUNCTION public.recalc_stock_quantity()
RETURNS TRIGGER AS $$
DECLARE
    target_item UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_item := OLD.stock_item_id;
    ELSE
        target_item := NEW.stock_item_id;
    END IF;

    UPDATE public.stock_items
       SET current_quantity = COALESCE((
              SELECT SUM(quantity) FROM public.stock_movements WHERE stock_item_id = target_item
           ), 0),
           updated_at = now()
     WHERE id = target_item;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stock_movements_after_change ON public.stock_movements;
CREATE TRIGGER stock_movements_after_change
    AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
    FOR EACH ROW EXECUTE FUNCTION public.recalc_stock_quantity();

-- RLS: solo authenticated users (luego refinamos a admin-only via app-side checks)
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock items read" ON public.stock_items;
CREATE POLICY "stock items read" ON public.stock_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stock items write" ON public.stock_items;
CREATE POLICY "stock items write" ON public.stock_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stock movements read" ON public.stock_movements;
CREATE POLICY "stock movements read" ON public.stock_movements FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "stock movements write" ON public.stock_movements;
CREATE POLICY "stock movements write" ON public.stock_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
