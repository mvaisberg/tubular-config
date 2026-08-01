-- Registro de aperturas del configurador (uso real), para medir tráfico y
-- conversión a cotización en el dashboard.
CREATE TABLE IF NOT EXISTS public.configurator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    device TEXT,
    referrer TEXT
);

CREATE INDEX IF NOT EXISTS configurator_sessions_created_at_idx
    ON public.configurator_sessions(created_at);
