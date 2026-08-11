-- Módulo de Marketing: rol nuevo + calendario de contenido IG + kanban de ideas.
--   - rol 'marketing': solo accede a /admin/marketing (gating en middleware)
--   - marketing_items: una fila por pieza de contenido; si tiene scheduled_date
--     aparece en el calendario, y siempre vive en una columna del kanban (status)
--   - bucket 'marketing' para las imágenes de las cards

-- 1. Rol marketing
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'sales', 'marketing'));

-- 2. Items de contenido
CREATE TABLE IF NOT EXISTS public.marketing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT 'slate',
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'produccion', 'listo')),
    scheduled_date DATE,
    sort_order DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff full access" ON public.marketing_items;
CREATE POLICY "staff full access" ON public.marketing_items
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketing_items_updated_at ON public.marketing_items;
CREATE TRIGGER marketing_items_updated_at
    BEFORE UPDATE ON public.marketing_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Bucket de imágenes (público para lectura; escritura solo autenticados)
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing', 'marketing', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "marketing read" ON storage.objects;
CREATE POLICY "marketing read" ON storage.objects
    FOR SELECT USING (bucket_id = 'marketing');
DROP POLICY IF EXISTS "marketing upload" ON storage.objects;
CREATE POLICY "marketing upload" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketing');
DROP POLICY IF EXISTS "marketing update" ON storage.objects;
CREATE POLICY "marketing update" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'marketing');
DROP POLICY IF EXISTS "marketing delete" ON storage.objects;
CREATE POLICY "marketing delete" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'marketing');
