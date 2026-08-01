-- Bandeja de WhatsApp (Meta Cloud API directo).
--
-- Modelo: un contacto por número (wa_id), una conversación abierta por contacto,
-- N mensajes por conversación. Los envíos automáticos (carrito abandonado,
-- pedido de review) van a una cola con dedupe para no spamear.
--
-- Reglas de WhatsApp que el esquema tiene que hacer cumplir:
--   * Fuera de la ventana de 24 h desde el último mensaje ENTRANTE del cliente
--     sólo se pueden mandar plantillas aprobadas → por eso last_inbound_at.
--   * Las plantillas de marketing exigen opt-in previo → por eso opt_in_*.
--   * Meta reenvía webhooks ante fallas → por eso wa_message_id es UNIQUE.

-- ── Contactos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Número en formato E.164 sin '+' , tal como lo manda Meta (ej: 5491122334455).
    wa_id TEXT NOT NULL UNIQUE,
    profile_name TEXT,
    display_name TEXT,

    -- Ventana de servicio: se puede responder libre sólo si
    -- now() - last_inbound_at < 24h. Lo actualiza el webhook en cada entrante.
    last_inbound_at TIMESTAMPTZ,

    -- Consentimiento. Sin esto no salen plantillas de marketing.
    opt_in BOOLEAN NOT NULL DEFAULT false,
    opt_in_at TIMESTAMPTZ,
    opt_in_source TEXT,          -- 'checkout' | 'manual' | 'inbound' | 'form'
    opt_out_at TIMESTAMPTZ,      -- si pidió baja, no se le manda nada automático

    blocked BOOLEAN NOT NULL DEFAULT false,

    -- Vínculo con el resto del manager (puede ser null: alguien que nunca compró).
    customer_email TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_contacts_wa_id_idx ON public.wa_contacts(wa_id);
CREATE INDEX IF NOT EXISTS wa_contacts_email_idx ON public.wa_contacts(customer_email);

-- ── Conversaciones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'pending', 'closed')),
    -- 'pending' = el agente escaló y espera a un humano.

    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Permite apagar la IA en una conversación puntual sin tocar la global.
    ai_enabled BOOLEAN NOT NULL DEFAULT true,
    -- Motivo por el que la IA escaló, para que el humano tenga contexto.
    escalation_reason TEXT,

    last_message_at TIMESTAMPTZ,
    unread_count INTEGER NOT NULL DEFAULT 0,

    -- Pedido asociado, si la charla es sobre uno concreto.
    order_id UUID REFERENCES public.admin_orders(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_conversations_contact_idx ON public.wa_conversations(contact_id);
CREATE INDEX IF NOT EXISTS wa_conversations_status_idx ON public.wa_conversations(status);
CREATE INDEX IF NOT EXISTS wa_conversations_last_msg_idx ON public.wa_conversations(last_message_at DESC);

-- Una sola conversación no-cerrada por contacto: evita hilos duplicados cuando
-- entran dos mensajes casi simultáneos.
CREATE UNIQUE INDEX IF NOT EXISTS wa_conversations_one_open_per_contact
    ON public.wa_conversations(contact_id) WHERE status <> 'closed';

-- ── Mensajes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,

    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),

    -- ID que asigna Meta (wamid.xxx). UNIQUE = idempotencia ante reenvíos del
    -- webhook. Es NULL sólo mientras un saliente está en vuelo.
    wa_message_id TEXT UNIQUE,

    msg_type TEXT NOT NULL DEFAULT 'text'
        CHECK (msg_type IN ('text', 'image', 'document', 'audio', 'video', 'sticker',
                            'location', 'contacts', 'button', 'interactive', 'template', 'system')),
    body TEXT,
    media_url TEXT,
    media_mime TEXT,

    -- Estado de entrega que reporta Meta por webhook.
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_code TEXT,
    error_detail TEXT,

    -- Sólo para salientes por plantilla.
    template_name TEXT,

    -- Quién lo mandó: usuario del manager, la IA, o una automatización.
    sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sent_by_ai BOOLEAN NOT NULL DEFAULT false,
    automation TEXT,             -- 'abandoned_cart' | 'review_request' | null

    -- Payload crudo del webhook, para debug cuando algo no cuadra.
    raw JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_messages_conversation_idx ON public.wa_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_messages_wa_id_idx ON public.wa_messages(wa_message_id);
CREATE INDEX IF NOT EXISTS wa_messages_status_idx ON public.wa_messages(status) WHERE status = 'failed';

-- ── Plantillas aprobadas ─────────────────────────────────────────────────────
-- Espejo local de lo que hay aprobado en Meta. Se sincroniza desde la API.
CREATE TABLE IF NOT EXISTS public.wa_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'es_AR',
    category TEXT CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    status TEXT CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED')),
    body_preview TEXT,
    -- Cantidad de variables {{1}}, {{2}}... que espera el body.
    variable_count INTEGER NOT NULL DEFAULT 0,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, language)
);

-- ── Cola de envíos automáticos ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_outbound_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,

    kind TEXT NOT NULL CHECK (kind IN ('abandoned_cart', 'review_request')),
    template_name TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,

    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'skipped', 'failed')),
    skip_reason TEXT,            -- 'no_opt_in' | 'opted_out' | 'blocked' | 'already_sent' | 'order_completed'

    -- Clave de deduplicación: p.ej. 'review_request:order:4562'. UNIQUE garantiza
    -- que un mismo evento no dispare dos mensajes aunque el cron corra dos veces.
    dedupe_key TEXT NOT NULL UNIQUE,

    order_id UUID REFERENCES public.admin_orders(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_jobs_due_idx ON public.wa_outbound_jobs(scheduled_at) WHERE status = 'queued';

-- ── updated_at automático ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wa_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wa_contacts_touch ON public.wa_contacts;
CREATE TRIGGER wa_contacts_touch BEFORE UPDATE ON public.wa_contacts
    FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();

DROP TRIGGER IF EXISTS wa_conversations_touch ON public.wa_conversations;
CREATE TRIGGER wa_conversations_touch BEFORE UPDATE ON public.wa_conversations
    FOR EACH ROW EXECUTE FUNCTION public.wa_touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Lectura para cualquier usuario logueado del manager. Las escrituras las hace
-- el webhook y los endpoints de envío con service role, que saltea RLS.
ALTER TABLE public.wa_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_outbound_jobs  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_contacts read" ON public.wa_contacts;
CREATE POLICY "wa_contacts read" ON public.wa_contacts
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_conversations read" ON public.wa_conversations;
CREATE POLICY "wa_conversations read" ON public.wa_conversations
    FOR SELECT TO authenticated USING (true);

-- Asignar, cerrar y apagar la IA se hace desde el cliente.
DROP POLICY IF EXISTS "wa_conversations update" ON public.wa_conversations;
CREATE POLICY "wa_conversations update" ON public.wa_conversations
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wa_messages read" ON public.wa_messages;
CREATE POLICY "wa_messages read" ON public.wa_messages
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_templates read" ON public.wa_templates;
CREATE POLICY "wa_templates read" ON public.wa_templates
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "wa_jobs read" ON public.wa_outbound_jobs;
CREATE POLICY "wa_jobs read" ON public.wa_outbound_jobs
    FOR SELECT TO authenticated USING (true);

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- La bandeja se actualiza sola, mismo patrón que store_contacts.
-- ALTER PUBLICATION no soporta IF NOT EXISTS, así que se chequea a mano para
-- que la migración se pueda re-correr sin romper.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wa_conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
    END IF;
END $$;
