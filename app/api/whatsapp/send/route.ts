/**
 * Envío de mensajes desde la bandeja del manager.
 *
 * POST { conversation_id, body }                  → texto libre (requiere ventana 24 h)
 * POST { conversation_id, template, variables? }  → plantilla aprobada (siempre válido)
 *
 * La regla de las 24 h se chequea acá y no en el cliente: si se manda texto
 * libre fuera de ventana Meta lo rechaza y cuenta como error de la app.
 */
import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import {
    sendText,
    sendTemplate,
    isWithinServiceWindow,
    isConfigured,
    WhatsAppError,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

interface Body {
    conversation_id?: string;
    body?: string;
    template?: string;
    language?: string;
    variables?: string[];
}

export async function POST(req: Request) {
    // Auth: cualquier usuario logueado del manager.
    const userClient = await createServerSupabase();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isConfigured()) {
        return NextResponse.json(
            { error: "WhatsApp no está configurado. Faltan WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN." },
            { status: 503 }
        );
    }

    let payload: Body;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const { conversation_id, body, template, language, variables } = payload;
    if (!conversation_id) {
        return NextResponse.json({ error: "Falta conversation_id" }, { status: 400 });
    }
    if (!body && !template) {
        return NextResponse.json({ error: "Falta body o template" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: "Supabase service role no configurado" }, { status: 500 });
    }
    const db = createServiceSupabase(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Conversación + contacto (para el wa_id y la ventana de servicio).
    const { data: conv, error: convErr } = await db
        .from("wa_conversations")
        .select("id, contact_id, wa_contacts!inner(wa_id, last_inbound_at, blocked, opt_out_at)")
        .eq("id", conversation_id)
        .single();

    if (convErr || !conv) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    }

    // Supabase devuelve el join como objeto o array según la relación.
    const contactRaw = (conv as unknown as { wa_contacts: unknown }).wa_contacts;
    const contact = (Array.isArray(contactRaw) ? contactRaw[0] : contactRaw) as {
        wa_id: string;
        last_inbound_at: string | null;
        blocked: boolean;
        opt_out_at: string | null;
    };

    if (contact.blocked) {
        return NextResponse.json({ error: "El contacto está bloqueado" }, { status: 409 });
    }

    const isTemplate = Boolean(template);

    // Texto libre sólo dentro de la ventana de 24 h.
    if (!isTemplate && !isWithinServiceWindow(contact.last_inbound_at)) {
        return NextResponse.json(
            {
                error: "Fuera de la ventana de 24 h. Sólo se puede enviar una plantilla aprobada.",
                code: "outside_service_window",
            },
            { status: 409 }
        );
    }

    // 1. Fila optimista en 'pending': si el envío falla queda el rastro del error.
    const { data: row, error: insErr } = await db
        .from("wa_messages")
        .insert({
            conversation_id,
            direction: "outbound",
            msg_type: isTemplate ? "template" : "text",
            body: isTemplate ? (body ?? `[plantilla: ${template}]`) : body,
            template_name: template ?? null,
            status: "pending",
            sent_by: user.id,
            sent_by_ai: false,
        })
        .select("id")
        .single();

    if (insErr || !row) {
        return NextResponse.json({ error: "No se pudo registrar el mensaje" }, { status: 500 });
    }

    // 2. Envío real.
    try {
        const waMessageId = isTemplate
            ? await sendTemplate(contact.wa_id, template!, language || "es_AR", variables || [])
            : await sendText(contact.wa_id, body!);

        await db
            .from("wa_messages")
            .update({ wa_message_id: waMessageId, status: "sent" })
            .eq("id", row.id);

        await db
            .from("wa_conversations")
            .update({ last_message_at: new Date().toISOString(), unread_count: 0 })
            .eq("id", conversation_id);

        return NextResponse.json({ ok: true, id: row.id, wa_message_id: waMessageId });
    } catch (e) {
        const err = e as WhatsAppError;
        await db
            .from("wa_messages")
            .update({
                status: "failed",
                error_code: err.code ? String(err.code) : null,
                error_detail: err.message?.slice(0, 500) ?? "error desconocido",
            })
            .eq("id", row.id);

        return NextResponse.json({ error: err.message || "Falló el envío" }, { status: 502 });
    }
}
