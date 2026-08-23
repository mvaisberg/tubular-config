// Tracking de uso del configurador (primera parte, en Supabase propio).
// Público, sin auth. kind:
//   'open'  → crea la sesión (uuid del navegador + UTMs + landing + device)
//   'event' → suma una interacción real (cambio de medida/color/preset/carrito…)
//   'ping'  → actualiza la duración de la visita
// No cuenta equipo propio: cookie tubular_no_stats, sesión admin o ?interno=1.

import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { isInternalRequest } from "@/lib/internal-traffic-server";

const s = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

export async function POST(req: Request) {
    try {
        if (await isInternalRequest(req)) return new NextResponse(null, { status: 204 });
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) return new NextResponse(null, { status: 204 });

        let body: Record<string, unknown> = {};
        try { body = await req.json(); } catch { /* body opcional */ }
        const kind = body.kind || "open";
        const key = s(body.session_key, 64);
        const db = createServiceSupabase(supabaseUrl, serviceKey);

        if (kind === "open") {
            await db.from("configurator_sessions").upsert({
                session_key: key,
                device: s(body.device, 20),
                referrer: s(body.referrer, 300),
                utm_source: s(body.utm_source, 80),
                utm_medium: s(body.utm_medium, 80),
                utm_campaign: s(body.utm_campaign, 120),
                utm_content: s(body.utm_content, 120),
                landing: s(body.landing, 20),
            }, { onConflict: "session_key", ignoreDuplicates: true });
        } else if (kind === "event" && key) {
            const price = typeof body.price === "number" && isFinite(body.price) ? body.price : null;
            await db.rpc("track_config_event", {
                p_key: key,
                p_event: s(body.event, 60) || "unknown",
                p_price: price,
            });
        } else if (kind === "ping" && key) {
            const seconds = Math.min(Math.max(Number(body.seconds) || 0, 0), 7200);
            if (seconds > 0) {
                await db.from("configurator_sessions")
                    .update({ duration_seconds: Math.round(seconds) })
                    .eq("session_key", key);
            }
        }
        return new NextResponse(null, { status: 204 });
    } catch {
        // El tracking nunca debe romper la carga del configurador.
        return new NextResponse(null, { status: 204 });
    }
}
