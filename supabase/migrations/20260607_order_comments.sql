-- Thread de comentarios por pedido.

CREATE TABLE IF NOT EXISTS public.order_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.admin_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_comments_order_id_idx ON public.order_comments(order_id);
CREATE INDEX IF NOT EXISTS order_comments_created_at_idx ON public.order_comments(created_at DESC);

ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all comments and insert their own.
DROP POLICY IF EXISTS "comments read" ON public.order_comments;
CREATE POLICY "comments read" ON public.order_comments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "comments insert own" ON public.order_comments;
CREATE POLICY "comments insert own" ON public.order_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments delete own" ON public.order_comments;
CREATE POLICY "comments delete own" ON public.order_comments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
