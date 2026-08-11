/**
 * Admin de plantillas de WhatsApp para el flujo de reviews.
 *
 * GET    → lista las plantillas del WABA (con estado de aprobación de Meta)
 *          + cuál está activa para el disparo de reviews.
 * POST   → crea una plantilla nueva en Meta (queda PENDING hasta que aprueben).
 * PUT    → elige qué plantilla usa el dispatcher (settings.reviews_template_name).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v21.0";

async function requireUser() {
    const userClient = await createServerSupabase();
    const { data: { user } } = await userClient.auth.getUser();
    return user;
}

function serviceDb() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function graphHeaders() {
    return { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" };
}

export async function GET() {
    if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const waba = process.env.WHATSAPP_WABA_ID;
    if (!waba) return NextResponse.json({ error: "WhatsApp no configurado" }, { status: 400 });

    const res = await fetch(
        `${GRAPH}/${waba}/message_templates?fields=name,status,language,category,components&limit=50`,
        { headers: graphHeaders() }
    );
    const json = await res.json();
    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 502 });

    const { data: settings } = await serviceDb()
        .from("settings")
        .select("reviews_template_name, reviews_template_language")
        .eq("id", 1)
        .single();

    // hello_world es la plantilla de muestra de Meta: no se puede borrar y no sirve
    // para el flujo — se oculta del panel.
    const templates = (json.data ?? []).filter((t: { name: string }) => t.name !== "hello_world");

    return NextResponse.json({
        templates,
        active: {
            name: settings?.reviews_template_name ?? null,
            language: settings?.reviews_template_language ?? "es_AR",
        },
    });
}

export async function POST(req: NextRequest) {
    if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const waba = process.env.WHATSAPP_WABA_ID;
    if (!waba) return NextResponse.json({ error: "WhatsApp no configurado" }, { status: 400 });

    const { name, body, example } = await req.json() as { name?: string; body?: string; example?: string[] };
    if (!name || !body) {
        return NextResponse.json({ error: "Faltan name o body" }, { status: 400 });
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
        return NextResponse.json({ error: "El nombre: solo minúsculas, números y guión bajo" }, { status: 400 });
    }
    // Variables {{1}}, {{2}}... — Meta exige ejemplos para aprobar.
    const varCount = new Set(body.match(/\{\{(\d+)\}\}/g) ?? []).size;
    const examples = (example ?? []).slice(0, varCount);
    if (varCount > 0 && examples.length !== varCount) {
        return NextResponse.json({ error: `La plantilla usa ${varCount} variables: mandá un ejemplo para cada una` }, { status: 400 });
    }

    const payload = {
        name,
        language: "es_AR",
        category: "MARKETING",
        components: [
            {
                type: "BODY",
                text: body,
                ...(varCount > 0 ? { example: { body_text: [examples] } } : {}),
            },
        ],
    };

    const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
        method: "POST",
        headers: graphHeaders(),
        body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 502 });

    return NextResponse.json({ ok: true, id: json.id, status: json.status });
}

export async function PUT(req: NextRequest) {
    if (!(await requireUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await req.json() as { name?: string };
    if (!name) return NextResponse.json({ error: "Falta name" }, { status: 400 });

    const { error } = await serviceDb()
        .from("settings")
        .update({ reviews_template_name: name })
        .eq("id", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, active: name });
}
