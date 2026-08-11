import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export type Role = "admin" | "sales" | "marketing";

// Server-only: lee el rol del usuario actual.
// Devuelve null si no hay sesión o no se puede determinar.
export async function getUserRole(): Promise<Role | null> {
    try {
        const userClient = await createServerSupabase();
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) return null;

        // Usa service role para evitar problemas de RLS al leer el propio profile.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) return null;
        const db = createServiceSupabase(supabaseUrl, serviceKey);

        const { data } = await db
            .from("profiles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

        return (data?.role as Role) || null;
    } catch {
        return null;
    }
}

// Devuelve true si el rol tiene permiso de ver montos/descuentos/totales.
export function canViewPricing(role: Role | null): boolean {
    return role === "admin";
}

// Páginas restringidas a admin.
const ADMIN_ONLY_PATHS = [
    "/admin/parts",
    "/admin/products",
    "/admin/settings",
    "/admin/reports",
    "/admin/cajas",
    "/admin/contabilidad",
];

export function isAdminOnlyPath(pathname: string): boolean {
    return ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"));
}
