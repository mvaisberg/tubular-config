-- Profiles + roles para el admin del configurador.
--   admin: acceso completo
--   sales: ve pedidos pero sin totales/descuentos; no entra a parts/settings/products

CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Cada user nuevo se crea como 'sales' por default. Cambiar a 'admin' manual.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, role)
    VALUES (NEW.id, 'sales')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada user lee su propio profile. Service role siempre puede.
DROP POLICY IF EXISTS "read own profile" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

-- Backfill: cargar profiles de users existentes (a sales) si no existen.
INSERT INTO public.profiles (user_id, role)
SELECT id, 'sales' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
