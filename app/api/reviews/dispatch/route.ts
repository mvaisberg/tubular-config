/**
 * Dispatcher del flujo de reviews. Lo llama un cron (X-Api-Key) cada hora.
 *
 * Fase 1 — encolar: pedidos entregados hace >= reviews_delay_days con WhatsApp
 *   cargado → un job en wa_outbound_jobs (dedupe por orden, nunca repite).
 * Fase 1b — segunda vuelta: a quienes no contestaron NADA a los
 *   reviews_followup_days del primer pedido, se les encola el 2º intento
 *   (una sola vez por review).
 * Fase 2 — enviar: jobs vencidos → plantilla aprobada vía Cloud API. Sólo a
 *   contactos con opt_in (si no, queda skipped/no_opt_in). Al enviar se crea la
 *   fila en wa_reviews (step 'sent'): de ahí en más la conversación la maneja
 *   el webhook con la máquina de estados.
 *
 * Nota: admin_orders no guarda fecha de entrega, se usa created_at como proxy
 * (pedido creado hace N días y hoy entregado).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTemplate, isConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const SEND_BATCH = 10; // techo por corrida (= por hora, el cron es horario): cuida el quality rating

// Normaliza un teléfono argentino a wa_id (549 + área + número, sin + ni espacios).
function toWaId(phone: string): string | null {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return null;
    if (digits.startsWith("549")) return digits;
    if (digits.startsWith("54")) return "549" + digits.slice(2);
    if (digits.length === 10) return "549" + digits; // 11XXXXXXXX estilo CABA
    return "54" + digits;
}

function firstName(full: string): string {
    return (full || "").trim().split(/\s+/)[0] || "Hola";
}

export async function POST(req: NextRequest) {
    const key = req.headers.get("x-api-key");
    if (!process.env.REVIEWS_CRON_KEY || key !== process.env.REVIEWS_CRON_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: settings } = await db
        .from("settings")
        .select("reviews_enabled, reviews_delay_days, reviews_followup_days, reviews_template_name, reviews_followup_template_name, reviews_template_language")
        .eq("id", 1)
        .single();

    if (!settings?.reviews_enabled) {
        return NextResponse.json({ ok: true, skipped: "reviews_disabled" });
    }
    if (!isConfigured()) {
        return NextResponse.json({ ok: true, skipped: "whatsapp_not_configured" });
    }

    const delayDays = settings.reviews_delay_days ?? 7;
    const template = settings.reviews_template_name || "review_request";
    const language = settings.reviews_template_language || "es_AR";
    const cutoff = new Date(Date.now() - delayDays * 24 * 3600 * 1000).toISOString();

    // ── Fase 1: encolar entregados sin job ──────────────────────────────────
    const { data: orders } = await db
        .from("admin_orders")
        .select("id, client_name, client_whatsapp, created_at")
        .eq("fulfillment_status", "delivered")
        .not("client_whatsapp", "is", null)
        .lte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(200);

    let queued = 0;
    for (const order of orders || []) {
        const waId = toWaId(order.client_whatsapp);
        if (!waId) continue;

        // Contacto: crear si no existe (opt_in false por default — el gate está en el envío).
        const { data: contact } = await db
            .from("wa_contacts")
            .upsert({ wa_id: waId }, { onConflict: "wa_id", ignoreDuplicates: false })
            .select("id")
            .single();
        if (!contact) continue;

        const { error } = await db.from("wa_outbound_jobs").insert({
            contact_id: contact.id,
            kind: "review_request",
            template_name: template,
            variables: [firstName(order.client_name), "mueble"],
            scheduled_at: new Date().toISOString(),
            dedupe_key: `review_request:${order.id}`,
            order_id: order.id,
        });
        if (!error) queued++;
        // conflicto de dedupe_key = ya estaba encolado: silencio y seguimos
    }

    const followupTemplateName = settings.reviews_followup_template_name || null;

    // ── Fase 1b: segunda vuelta para quienes no contestaron nada ────────────
    // A los N días del primer pedido sin una sola respuesta, se encola un
    // followup con la plantilla del 2º intento. Una sola vez por review.
    const followupDays = settings.reviews_followup_days ?? 7;
    let queuedFollowups = 0;
    if (followupTemplateName) {
        const fCutoff = new Date(Date.now() - followupDays * 24 * 3600 * 1000).toISOString();
        const { data: silent } = await db
            .from("wa_reviews")
            .select("id, contact_id, order_id, requested_at")
            .is("responded_at", null)
            .in("step", ["sent", "expired"])
            .lte("requested_at", fCutoff)
            .limit(200);

        for (const rev of silent || []) {
            const { error } = await db.from("wa_outbound_jobs").insert({
                contact_id: rev.contact_id,
                kind: "review_followup",
                template_name: followupTemplateName,
                variables: ["Hola", "mueble"],
                scheduled_at: new Date().toISOString(),
                dedupe_key: `review_followup:${rev.id}`,
                order_id: rev.order_id,
            });
            if (!error) queuedFollowups++;
            // conflicto de dedupe_key = ya se le mandó el 2º intento: se saltea
        }
    }

    // ── Fase 2: enviar vencidos ─────────────────────────────────────────────
    // Cada kind de job usa la plantilla activa en settings al momento del envío
    // (no la que quedó grabada al encolarse): cambiar la plantilla desde el
    // panel afecta también a la cola pendiente. Las variables se adaptan a la
    // cantidad de {{n}} que la plantilla realmente usa. Un kind cuya plantilla
    // no esté aprobada deja sus jobs en cola sin marcar (salen al aprobarse).
    const followupTemplate = followupTemplateName;
    const tplByKind: Record<string, { name: string; varCount: number } | null> = {
        review_request: null,
        review_followup: null,
    };
    try {
        const tplRes = await fetch(
            `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_WABA_ID}/message_templates?fields=name,language,status,components&limit=50`,
            { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
        );
        const tplJson = await tplRes.json() as { data?: { name: string; language: string; status: string; components?: { type: string; text?: string }[] }[] };
        const resolve = (name: string | null) => {
            const tpl = name ? (tplJson.data ?? []).find(t => t.name === name && t.language === language) : undefined;
            if (!tpl || tpl.status !== "APPROVED") return null;
            const bodyText = tpl.components?.find(c => c.type === "BODY")?.text ?? "";
            return { name: name!, varCount: new Set(bodyText.match(/\{\{\d+\}\}/g) ?? []).size };
        };
        tplByKind.review_request = resolve(template);
        tplByKind.review_followup = resolve(followupTemplate);
    } catch {
        // Si Meta no responde, mejor no enviar en esta corrida que enviar mal.
        return NextResponse.json({ ok: false, skipped: "template_check_failed" });
    }

    const sendableKinds = Object.keys(tplByKind).filter(k => tplByKind[k]);
    if (!sendableKinds.length) {
        return NextResponse.json({ ok: false, skipped: "template_not_approved", template });
    }

    const { data: jobs } = await db
        .from("wa_outbound_jobs")
        .select("id, contact_id, kind, template_name, variables, order_id, wa_contacts!inner(id, wa_id, opt_in, opt_out_at, blocked)")
        .eq("status", "queued")
        .in("kind", sendableKinds)
        .eq("wa_contacts.opt_in", true)
        .lte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(SEND_BATCH);

    let sent = 0, skippedNoOptIn = 0, failed = 0;
    for (const job of jobs || []) {
        const contact = job.wa_contacts as unknown as {
            id: string; wa_id: string; opt_in: boolean; opt_out_at: string | null; blocked: boolean;
        } | null;

        // Opt-out o bloqueado después de encolarse: este sí se descarta.
        if (!contact || contact.opt_out_at || contact.blocked) {
            await db.from("wa_outbound_jobs")
                .update({ status: "skipped", skip_reason: "opt_out" })
                .eq("id", job.id);
            skippedNoOptIn++;
            continue;
        }

        try {
            const tpl = tplByKind[job.kind as string]!;
            // Variables: nombre del cliente primero, relleno genérico después,
            // recortado a lo que la plantilla activa necesita.
            const stored = (job.variables as string[]) || [];
            const pool = [stored[0] || "Hola", stored[1] || "mueble"];
            const variables = Array.from({ length: tpl.varCount }, (_, i) => pool[i] ?? "mueble");

            const waMessageId = await sendTemplate(contact.wa_id, tpl.name, language, variables);

            // Conversación: reusar la abierta o crear una nueva para la orden.
            let conversationId: string | null = null;
            const { data: existingConv } = await db
                .from("wa_conversations")
                .select("id")
                .eq("contact_id", contact.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                const { data: conv } = await db
                    .from("wa_conversations")
                    .insert({ contact_id: contact.id, order_id: job.order_id })
                    .select("id")
                    .single();
                conversationId = conv?.id ?? null;
            }

            if (conversationId) {
                await db.from("wa_messages").insert({
                    conversation_id: conversationId,
                    direction: "outbound",
                    wa_message_id: waMessageId || null,
                    msg_type: "template",
                    template_name: tpl.name,
                    body: `[plantilla: ${tpl.name}]`,
                    status: waMessageId ? "sent" : "pending",
                    sent_by_ai: true,
                    automation: job.kind as string,
                });
            }

            if (job.kind === "review_followup") {
                // Segundo intento: la review ya existe — si venció, se reactiva
                // para que el webhook retome la conversación. No se crea otra.
                await db.from("wa_reviews")
                    .update({ step: "sent" })
                    .eq("contact_id", contact.id)
                    .eq("step", "expired");
            } else {
                await db.from("wa_reviews").insert({
                    contact_id: contact.id,
                    conversation_id: conversationId,
                    order_id: job.order_id,
                    step: "sent",
                    requested_at: new Date().toISOString(),
                });
            }

            await db.from("wa_outbound_jobs")
                .update({ status: "sent", sent_at: new Date().toISOString() })
                .eq("id", job.id);
            sent++;
        } catch (e) {
            await db.from("wa_outbound_jobs")
                .update({ status: "failed", skip_reason: (e as Error).message.slice(0, 200) })
                .eq("id", job.id);
            failed++;
        }
    }

    return NextResponse.json({ ok: true, queued, queued_followups: queuedFollowups, sent, skipped_no_opt_in: skippedNoOptIn, failed });
}
