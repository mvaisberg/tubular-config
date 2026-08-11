/**
 * Webhook de WhatsApp Cloud API.
 *
 * URL a registrar en Meta:
 *   https://tubular.com.ar/configurador/api/whatsapp/webhook
 *
 * GET  → handshake de verificación (Meta manda hub.challenge una sola vez).
 * POST → mensajes entrantes y cambios de estado de los salientes.
 *
 * Este endpoint es PÚBLICO (el middleware sólo protege /admin), así que la
 * firma X-Hub-Signature-256 es la única barrera: sin validarla cualquiera
 * podría inyectar mensajes falsos en la bandeja.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhookSignature, getMediaUrl } from "@/lib/whatsapp";
import { processReviewMessage } from "@/lib/review-processor";

export const dynamic = "force-dynamic";

// ── GET: verificación ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const mode = params.get("hub.mode");
    const token = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");

    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        // Meta espera el challenge crudo, sin comillas ni JSON.
        return new NextResponse(challenge ?? "", { status: 200 });
    }
    return new NextResponse("Forbidden", { status: 403 });
}

// ── Tipos del payload de Meta (sólo lo que usamos) ───────────────────────────
interface WaMessage {
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    image?: { id: string; caption?: string; mime_type?: string };
    document?: { id: string; filename?: string; caption?: string; mime_type?: string };
    audio?: { id: string; mime_type?: string };
    video?: { id: string; caption?: string; mime_type?: string };
    sticker?: { id: string };
    location?: { latitude: number; longitude: number; name?: string };
    button?: { text: string; payload: string };
    interactive?: {
        type: string;
        button_reply?: { id: string; title: string };
        list_reply?: { id: string; title: string };
    };
}

interface WaStatus {
    id: string;
    status: string;
    timestamp: string;
    errors?: Array<{ code: number; title: string; message?: string }>;
}

interface WaValue {
    messaging_product: string;
    metadata?: { phone_number_id: string };
    contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
    messages?: WaMessage[];
    statuses?: WaStatus[];
}

/** Extrae el texto mostrable de cualquier tipo de mensaje entrante. */
function messageBody(m: WaMessage): string {
    switch (m.type) {
        case "text": return m.text?.body ?? "";
        case "image": return m.image?.caption ?? "";
        case "document": return m.document?.caption ?? m.document?.filename ?? "";
        case "video": return m.video?.caption ?? "";
        case "button": return m.button?.text ?? "";
        case "interactive":
            return m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        case "location": {
            const l = m.location;
            return l ? (l.name ?? `${l.latitude}, ${l.longitude}`) : "";
        }
        default: return "";
    }
}

/** El id del media adjunto, si el mensaje trae uno. */
function mediaId(m: WaMessage): string | null {
    return m.image?.id ?? m.document?.id ?? m.audio?.id ?? m.video?.id ?? m.sticker?.id ?? null;
}

const KNOWN_TYPES = new Set([
    "text", "image", "document", "audio", "video", "sticker",
    "location", "contacts", "button", "interactive",
]);

// ── POST: eventos ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    // La firma se calcula sobre el body crudo: hay que leerlo como texto ANTES
    // de parsear el JSON.
    const rawBody = await req.text();

    if (!verifyWebhookSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
        console.warn("[wa-webhook] firma inválida — request descartada");
        return new NextResponse("Forbidden", { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        console.error("[wa-webhook] falta config de Supabase");
        // 200 igual: si devolvemos error Meta reintenta en loop.
        return NextResponse.json({ ok: true });
    }
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let payload: { entry?: Array<{ changes?: Array<{ value?: WaValue }> }> };
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ ok: true });
    }

    try {
        for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
                const value = change.value;
                if (!value) continue;

                await handleStatuses(db, value.statuses ?? []);
                await handleMessages(db, value);
            }
        }
    } catch (e) {
        // Nunca devolver 5xx: Meta reintenta con backoff y puede llegar a
        // deshabilitar el webhook. Se loguea y se sigue.
        console.error("[wa-webhook] error procesando:", e);
    }

    return NextResponse.json({ ok: true });
}

// El proyecto no tiene tipos generados de la DB. Sin el `any` explícito los
// genéricos derivados de SupabaseClient colapsan a `never` y todo insert falla
// a compilar.
type Db = ReturnType<typeof createClient<any>>;

/** Actualiza el estado de entrega de los salientes (sent/delivered/read/failed). */
async function handleStatuses(db: Db, statuses: WaStatus[]) {
    for (const s of statuses) {
        const patch: Record<string, unknown> = { status: s.status };
        if (s.errors?.length) {
            patch.status = "failed";
            patch.error_code = String(s.errors[0].code);
            patch.error_detail = s.errors[0].message || s.errors[0].title;
        }
        await db.from("wa_messages").update(patch).eq("wa_message_id", s.id);
    }
}

/** Persiste los entrantes: contacto → conversación → mensaje. */
async function handleMessages(db: Db, value: WaValue) {
    const messages = value.messages ?? [];
    if (!messages.length) return;

    const profileName = value.contacts?.[0]?.profile?.name ?? null;

    for (const m of messages) {
        const waId = m.from;
        // Meta manda epoch en SEGUNDOS.
        const receivedAt = new Date(Number(m.timestamp) * 1000).toISOString();

        // 1. Contacto (upsert por wa_id).
        const { data: contact, error: cErr } = await db
            .from("wa_contacts")
            .upsert(
                {
                    wa_id: waId,
                    profile_name: profileName,
                    last_inbound_at: receivedAt,
                },
                { onConflict: "wa_id" }
            )
            .select("id, blocked")
            .single();

        if (cErr || !contact) {
            console.error("[wa-webhook] no se pudo upsertear contacto", waId, cErr?.message);
            continue;
        }
        if (contact.blocked) continue;

        // 2. Conversación abierta (el índice único garantiza una sola por contacto).
        const { data: existing } = await db
            .from("wa_conversations")
            .select("id")
            .eq("contact_id", contact.id)
            .neq("status", "closed")
            .maybeSingle();

        let conversationId = existing?.id as string | undefined;

        if (!conversationId) {
            const { data: created, error: convErr } = await db
                .from("wa_conversations")
                .insert({ contact_id: contact.id, status: "open", last_message_at: receivedAt })
                .select("id")
                .single();

            if (convErr || !created) {
                // Carrera: otro webhook simultáneo la creó primero. Releer.
                const { data: retry } = await db
                    .from("wa_conversations")
                    .select("id")
                    .eq("contact_id", contact.id)
                    .neq("status", "closed")
                    .maybeSingle();
                conversationId = retry?.id as string | undefined;
            } else {
                conversationId = created.id as string;
            }
        }
        if (!conversationId) continue;

        // 3. Media, si trae.
        let mediaUrl: string | null = null;
        let mediaMime: string | null = null;
        const mid = mediaId(m);
        if (mid) {
            const media = await getMediaUrl(mid).catch(() => null);
            if (media) {
                // Es una URL temporal de Meta y requiere el token para descargar.
                // Se guarda para que el visor de la bandeja la proxee.
                mediaUrl = media.url;
                mediaMime = media.mime;
            }
        }

        // 4. Mensaje. onConflict sobre wa_message_id = idempotencia ante reenvíos.
        const { error: mErr } = await db.from("wa_messages").upsert(
            {
                conversation_id: conversationId,
                direction: "inbound",
                wa_message_id: m.id,
                msg_type: KNOWN_TYPES.has(m.type) ? m.type : "system",
                body: messageBody(m),
                media_url: mediaUrl,
                media_mime: mediaMime,
                status: "delivered",
                raw: m as unknown as Record<string, unknown>,
                created_at: receivedAt,
            },
            { onConflict: "wa_message_id", ignoreDuplicates: true }
        );

        if (mErr) {
            console.error("[wa-webhook] no se pudo guardar mensaje", m.id, mErr.message);
            continue;
        }

        // 5. Reabrir si estaba cerrada y refrescar contadores.
        const { data: conv } = await db
            .from("wa_conversations")
            .select("unread_count")
            .eq("id", conversationId)
            .single();

        await db
            .from("wa_conversations")
            .update({
                last_message_at: receivedAt,
                unread_count: (conv?.unread_count ?? 0) + 1,
                status: "open",
            })
            .eq("id", conversationId);

        // 6. Flujo de reviews. Si el contacto tiene un pedido de review activo,
        // este mensaje lo hace avanzar y se contesta automáticamente. Si no,
        // devuelve handled=false y el mensaje queda para que lo atienda un humano.
        try {
            const review = await processReviewMessage({
                db,
                contactId: contact.id as string,
                conversationId,
                message: {
                    type: m.type,
                    body: messageBody(m),
                    hasImage: m.type === "image",
                    hasVideo: m.type === "video",
                },
                mediaUrl,
                mediaMime,
            });
            if (review.error) {
                console.error("[wa-webhook] flujo de reviews:", review.error);
            }
        } catch (e) {
            // Que falle el flujo de reviews no puede romper la recepción normal.
            console.error("[wa-webhook] flujo de reviews explotó:", e);
        }
    }
}
