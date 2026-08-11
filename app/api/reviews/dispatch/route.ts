/**
 * Dispatcher del flujo de reviews. Lo llama un cron (X-Api-Key) cada hora.
 *
 * Fase 1 — encolar: pedidos entregados hace >= reviews_delay_days con WhatsApp
 *   cargado → un job en wa_outbound_jobs (dedupe por orden, nunca repite).
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
        .select("reviews_enabled, reviews_delay_days, reviews_template_name, reviews_template_language")
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

    // ── Fase 2: enviar vencidos ─────────────────────────────────────────────
    // Sólo jobs de contactos CON opt-in: los demás quedan en cola esperando el
    // consentimiento (si el cliente opta después, el pedido de review sale igual).
    const { data: jobs } = await db
        .from("wa_outbound_jobs")
        .select("id, contact_id, template_name, variables, order_id, wa_contacts!inner(id, wa_id, opt_in, opt_out_at, blocked)")
        .eq("status", "queued")
        .eq("kind", "review_request")
        .eq("wa_contacts.opt_in", true)
        .lte("scheduled_at", new Date().toISOString())
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
            const waMessageId = await sendTemplate(
                contact.wa_id,
                job.template_name,
                language,
                (job.variables as string[]) || []
            );

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
                    template_name: job.template_name,
                    body: `[plantilla: ${job.template_name}]`,
                    status: waMessageId ? "sent" : "pending",
                    sent_by_ai: true,
                    automation: "review_request",
                });
            }

            await db.from("wa_reviews").insert({
                contact_id: contact.id,
                conversation_id: conversationId,
                order_id: job.order_id,
                step: "sent",
                requested_at: new Date().toISOString(),
            });

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

    return NextResponse.json({ ok: true, queued, sent, skipped_no_opt_in: skippedNoOptIn, failed });
}
