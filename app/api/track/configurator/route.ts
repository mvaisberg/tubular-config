// Registra una apertura del configurador (uso real). Público, sin auth.
// Usa el proyecto Supabase del configurador (API REST con service role).

import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) return new NextResponse(null, { status: 204 });

        let body: { device?: string; referrer?: string } = {};
        try { body = await req.json(); } catch { /* body opcional */ }

        const db = createServiceSupabase(supabaseUrl, serviceKey);
        await db.from("configurator_sessions").insert({
            device: (body.device || "").slice(0, 20) || null,
            referrer: (body.referrer || "").slice(0, 300) || null,
        });
        return new NextResponse(null, { status: 204 });
    } catch {
        // El tracking nunca debe romper la carga del configurador.
        return new NextResponse(null, { status: 204 });
    }
}
