/**
 * Informe de tráfico y uso real del configurador — sólo admin.
 * Segmenta publicidad (con UTM) vs orgánico/directo, y mide si cada visita
 * realmente usó el configurador (interacciones > 0) o fue tráfico basura.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface Row {
    created_at: string;
    device: string | null;
    referrer: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    landing: string | null;
    interactions: number;
    duration_seconds: number | null;
    shared: boolean;
    added_to_cart: boolean;
    last_price: number | null;
    session_key: string | null;
}

function agg(rows: Row[]) {
    const n = rows.length;
    const engaged = rows.filter(r => r.interactions > 0);
    const withDur = rows.filter(r => (r.duration_seconds ?? 0) > 0);
    const junk = rows.filter(r => r.interactions === 0 && (r.duration_seconds ?? 0) < 10);
    return {
        sessions: n,
        engaged: engaged.length,
        engagedPct: n ? Math.round(engaged.length / n * 100) : 0,
        junk: junk.length,
        junkPct: n ? Math.round(junk.length / n * 100) : 0,
        avgInteractions: engaged.length ? +(engaged.reduce((a, r) => a + r.interactions, 0) / engaged.length).toFixed(1) : 0,
        avgDuration: withDur.length ? Math.round(withDur.reduce((a, r) => a + (r.duration_seconds || 0), 0) / withDur.length) : 0,
        shared: rows.filter(r => r.shared).length,
        addedToCart: rows.filter(r => r.added_to_cart).length,
        mobile: rows.filter(r => r.device === "mobile").length,
    };
}

export async function GET(req: NextRequest) {
    const auth = await createServerSupabase();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if ((await getUserRole()) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    if (!from || !to) return NextResponse.json({ error: "Faltan from/to" }, { status: 400 });

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await db
        .from("configurator_sessions")
        .select("created_at, device, referrer, utm_source, utm_medium, utm_campaign, landing, interactions, duration_seconds, shared, added_to_cart, last_price, session_key")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59.999Z")
        .order("created_at", { ascending: false })
        .limit(20000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []) as Row[];
    // Filas anteriores al tracking nuevo (sin session_key) no tienen datos de uso:
    // cuentan como sesión pero se excluyen de los % de uso/basura.
    const tracked = rows.filter(r => r.session_key);
    const legacy = rows.length - tracked.length;

    const paid = tracked.filter(r => r.utm_source);
    const organic = tracked.filter(r => !r.utm_source);

    // Por campaña (solo pagas).
    const byCampaign: Record<string, Row[]> = {};
    for (const r of paid) {
        const k = `${r.utm_source}${r.utm_campaign ? " · " + r.utm_campaign : ""}`;
        (byCampaign[k] ??= []).push(r);
    }
    // Por referrer (orgánico) — dominio.
    const byRef: Record<string, Row[]> = {};
    for (const r of organic) {
        let k = "directo";
        if (r.referrer) { try { k = new URL(r.referrer).hostname.replace(/^www\./, ""); } catch { k = "otro"; } }
        (byRef[k] ??= []).push(r);
    }

    return NextResponse.json({
        total: agg(tracked),
        legacySessions: legacy,
        paid: agg(paid),
        organic: agg(organic),
        campaigns: Object.entries(byCampaign)
            .map(([name, rs]) => ({ name, ...agg(rs) }))
            .sort((a, b) => b.sessions - a.sessions),
        referrers: Object.entries(byRef)
            .map(([name, rs]) => ({ name, ...agg(rs) }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 12),
    });
}
