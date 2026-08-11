-- Sistema de reviews por WhatsApp.
--
-- Flujo conversacional en 3 pasos, cada uno opcional (el cliente puede cortar
-- en cualquier momento y lo que dejó igual sirve):
--   1. puntuación 1-5
--   2. comentario
--   3. foto → a cambio, cupón de descuento
--
-- Importante sobre la ventana de 24 h: SÓLO el disparo inicial necesita
-- plantilla aprobada, porque sale en frío. En cuanto el cliente responde se
-- abre la ventana y los pasos 2 y 3 salen como texto libre, sin plantilla.
-- Por eso el flujo está diseñado para que el primer paso sea el más simple
-- posible: que conteste cualquier cosa.

-- ── Estado de cada pedido de review ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    contact_id UUID NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
    -- Un pedido de review por orden. El UNIQUE de abajo evita duplicados.
    order_id UUID REFERENCES public.admin_orders(id) ON DELETE CASCADE,

    -- Máquina de estados. El webhook la avanza según lo que conteste el cliente.
    step TEXT NOT NULL DEFAULT 'queued' CHECK (step IN (
        'queued',           -- creado, todavía no salió
        'sent',             -- salió la plantilla, esperando primera respuesta
        'awaiting_rating',  -- contestó algo, se le pidió la puntuación
        'awaiting_comment', -- puntuó, se le pidió comentario
        'awaiting_photo',   -- comentó, se le pidió foto
        'completed',        -- mandó foto (o cerró el flujo)
        'declined',         -- pidió que no lo molesten
        'expired'           -- se quedó sin contestar
    )),

    rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    -- Puede mandar más de una foto; se guardan todas en Supabase Storage.
    photo_urls TEXT[] NOT NULL DEFAULT '{}',

    -- Cupón que se le entregó a cambio de la foto.
    coupon_code TEXT,
    coupon_sent_at TIMESTAMPTZ,

    -- Timestamps por paso: alimentan el dashboard (tasa de respuesta, embudo).
    requested_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    rated_at TIMESTAMPTZ,
    commented_at TIMESTAMPTZ,
    photo_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Último prompt enviado, para no repreguntar en loop si el cliente escribe
    -- cualquier otra cosa.
    last_prompt_at TIMESTAMPTZ,
    prompt_count SMALLINT NOT NULL DEFAULT 0,

    -- Publicación: el equipo decide qué review se muestra en la web.
    published BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un solo pedido de review por orden.
CREATE UNIQUE INDEX IF NOT EXISTS wa_reviews_one_per_order
    ON public.wa_reviews(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS wa_reviews_contact_idx ON public.wa_reviews(contact_id);
CREATE INDEX IF NOT EXISTS wa_reviews_step_idx ON public.wa_reviews(step);
CREATE INDEX IF NOT EXISTS wa_reviews_created_idx ON public.wa_reviews(created_at DESC);
-- Para el flujo: buscar rápido el review activo de un contacto.
CREATE INDEX IF NOT EXISTS wa_reviews_active_idx ON public.wa_reviews(contact_id)
    WHERE step IN ('sent', 'awaiting_rating', 'awaiting_comment', 'awaiting_photo');

-- ── Config del sistema de reviews ────────────────────────────────────────────
-- Va en la tabla settings que ya existe (fila única id=1), como el resto.
ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS reviews_enabled BOOLEAN NOT NULL DEFAULT false,
    -- Días a esperar después de entregar el pedido antes de pedir la review.
    ADD COLUMN IF NOT EXISTS reviews_delay_days SMALLINT NOT NULL DEFAULT 7,
    -- Descuento que se ofrece a cambio de la foto.
    ADD COLUMN IF NOT EXISTS reviews_photo_discount_percent SMALLINT NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS reviews_coupon_days_valid SMALLINT NOT NULL DEFAULT 30,
    -- Nombre de la plantilla aprobada en Meta para el disparo inicial.
    ADD COLUMN IF NOT EXISTS reviews_template_name TEXT DEFAULT 'review_request',
    ADD COLUMN IF NOT EXISTS reviews_template_language TEXT DEFAULT 'es_AR';

-- ── updated_at ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS wa_reviews_touch ON public.wa_reviews;
CREATE TRIGGER wa_reviews_touch BEFORE UPDATE ON public.wa_reviews
    FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.wa_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_reviews read" ON public.wa_reviews;
CREATE POLICY "wa_reviews read" ON public.wa_reviews
    FOR SELECT TO authenticated USING (true);

-- Publicar/despublicar y editar notas se hace desde el manager.
DROP POLICY IF EXISTS "wa_reviews update" ON public.wa_reviews;
CREATE POLICY "wa_reviews update" ON public.wa_reviews
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_reviews'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_reviews;
    END IF;
END $$;
