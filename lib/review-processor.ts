/**
 * Conecta la máquina de estados del flujo de reviews con el mundo real:
 * base de datos, envío por WhatsApp, storage de fotos y cupones de Woo.
 *
 * Lo llama el webhook cada vez que entra un mensaje. Si el contacto no tiene un
 * review activo, no hace nada y deja pasar el mensaje a la bandeja normal.
 */
import { createClient } from "@supabase/supabase-js";
import { advanceReviewFlow, type ReviewState, type InboundMessage, type FlowResult } from "@/lib/review-flow";
import { agentAdvanceReviewFlow, agentAvailable, type ConversationTurn } from "@/lib/review-agent";
import { sendText } from "@/lib/whatsapp";
import { createReviewCoupon } from "@/lib/woo-coupons";

type Db = ReturnType<typeof createClient<any>>;

const ACTIVE_STEPS = ["sent", "awaiting_rating", "awaiting_comment", "awaiting_photo"];
const PHOTO_BUCKET = "reviews";

interface ProcessArgs {
    db: Db;
    contactId: string;
    conversationId: string;
    message: InboundMessage;
    /** URL temporal de Meta para el media, si el mensaje trae foto. */
    mediaUrl?: string | null;
    mediaMime?: string | null;
}

export interface ProcessResult {
    handled: boolean;
    reply?: string;
    step?: string;
    error?: string;
}

/**
 * Procesa un mensaje entrante en el contexto del flujo de reviews.
 * Devuelve handled=false si no había un review activo (el mensaje sigue su
 * curso normal hacia la bandeja).
 */
export async function processReviewMessage(args: ProcessArgs): Promise<ProcessResult> {
    const { db, contactId, conversationId, message } = args;

    // ¿Hay un review activo para este contacto? Los completados recientes también
    // entran: el cliente suele seguir la charla después del cierre ("¿te mando
    // otra?", "¿sirve un video?") y el agente tiene que responder, aceptar más
    // media y entregar el cupón si quedó pendiente.
    const FOLLOWUP_WINDOW_H = 72;
    const { data: review } = await db
        .from("wa_reviews")
        .select("id, step, rating, comment, photo_urls, prompt_count, coupon_code, updated_at")
        .eq("contact_id", contactId)
        .in("step", [...ACTIVE_STEPS, "completed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!review) return { handled: false };

    const flowClosed = review.step === "completed";
    if (flowClosed) {
        const ageH = (Date.now() - new Date(review.updated_at as string).getTime()) / 3_600_000;
        // Sin agente la máquina no maneja estados terminales; y pasada la ventana,
        // el mensaje va a la bandeja humana como siempre.
        if (!agentAvailable() || ageH > FOLLOWUP_WINDOW_H) return { handled: false };
    }

    // Config desde settings (fila única id=1).
    const { data: settings } = await db
        .from("settings")
        .select("reviews_photo_discount_percent, reviews_coupon_days_valid")
        .eq("id", 1)
        .single();

    const discountPercent = settings?.reviews_photo_discount_percent ?? 10;
    const couponDaysValid = settings?.reviews_coupon_days_valid ?? 30;

    const state: ReviewState = {
        step: review.step,
        rating: review.rating,
        comment: review.comment,
        photo_count: (review.photo_urls ?? []).length,
        prompt_count: review.prompt_count ?? 0,
    };

    // El cupón se genera ANTES de correr el flujo sólo si va a hacer falta, para
    // poder meter el código en el texto de la respuesta. Un solo cupón por review.
    const hasMedia = message.hasImage || Boolean(message.hasVideo);
    const willIssueCoupon = hasMedia && !review.coupon_code;

    let couponCode: string | undefined;
    let couponError: string | undefined;
    if (willIssueCoupon) {
        try {
            const coupon = await createReviewCoupon(
                discountPercent,
                couponDaysValid,
                `Review con foto — contacto ${contactId.slice(0, 8)}`
            );
            couponCode = coupon.code;
        } catch (e) {
            // Si Woo falla no se pierde la foto ni la review: se agradece igual y
            // queda registrado para emitir el cupón a mano.
            couponError = (e as Error).message;
        }
    }

    const flowConfig = { discountPercent, couponDaysValid, couponCode };

    // Agente conversacional (Claude) con fallback a la máquina de estados: si no
    // hay key o la API falla, el flujo rígido sigue funcionando igual que siempre.
    let result: FlowResult;
    if (agentAvailable()) {
        try {
            const [{ data: historyRows }, { data: contactRow }] = await Promise.all([
                db.from("wa_messages")
                    .select("direction, body")
                    .eq("conversation_id", conversationId)
                    .order("created_at", { ascending: false })
                    .limit(12),
                db.from("wa_contacts").select("profile_name, display_name").eq("id", contactId).single(),
            ]);
            const history: ConversationTurn[] = (historyRows ?? [])
                .reverse()
                .filter(m => m.body)
                .map(m => ({ direction: m.direction === "inbound" ? "inbound" : "outbound", body: m.body as string }));
            const customerName = contactRow?.display_name || contactRow?.profile_name || null;

            result = await agentAdvanceReviewFlow(state, message, flowConfig, history, customerName, flowClosed);
        } catch (e) {
            console.error("[reviews] agente falló, fallback a máquina de estados:", (e as Error).message);
            result = advanceReviewFlow(state, message, flowConfig);
        }
    } else {
        result = advanceReviewFlow(state, message, flowConfig);
    }

    if (!result.reply && Object.keys(result.patch).length === 0) {
        return { handled: false };
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {};

    if (result.patch.step) patch.step = result.patch.step;
    if (result.patch.rating !== undefined) {
        patch.rating = result.patch.rating;
        patch.rated_at = now;
    }
    if (result.patch.comment !== undefined) {
        patch.comment = result.patch.comment;
        patch.commented_at = now;
    }
    if (result.patch.responded) patch.responded_at = now;
    if (result.patch.resetPrompt) patch.prompt_count = 0;
    if (result.patch.incrementPrompt) patch.prompt_count = state.prompt_count + 1;
    if (result.patch.step === "completed") patch.completed_at = now;

    // Guardar la foto en storage.
    if (result.savePhoto && args.mediaUrl) {
        const stored = await storePhoto(db, args.mediaUrl, args.mediaMime ?? "image/jpeg", review.id);
        if (stored) {
            patch.photo_urls = [...(review.photo_urls ?? []), stored];
            patch.photo_at = now;
        }
    }

    // El cupón se registra sólo si el flujo decidió entregarlo (el agente puede
    // descartar media que no es del mueble).
    if (couponCode && result.issueCoupon) {
        patch.coupon_code = couponCode;
        patch.coupon_sent_at = now;
    }

    // Si falló el cupón, se deja el rastro para que el equipo lo emita a mano.
    if (couponError) {
        patch.coupon_code = null;
        patch.comment = `${result.patch.comment ?? review.comment ?? ""}`.trim() || review.comment;
    }

    if (result.reply) patch.last_prompt_at = now;

    await db.from("wa_reviews").update(patch).eq("id", review.id);

    // Enviar la respuesta. Siempre dentro de la ventana de 24 h, porque el
    // cliente acaba de escribir.
    let replyText = result.reply;
    if (replyText && couponError) {
        replyText =
            "¡Gracias por la foto! 📸 Te mandamos el cupón de descuento por acá en un ratito.";
        console.error("[reviews] no se pudo emitir cupón:", couponError);
    }

    if (replyText) {
        try {
            const waId = await sendText(await contactWaId(db, contactId), replyText);
            await db.from("wa_messages").insert({
                conversation_id: conversationId,
                direction: "outbound",
                wa_message_id: waId || null,
                msg_type: "text",
                body: replyText,
                status: waId ? "sent" : "pending",
                sent_by_ai: true,
                automation: "review_request",
            });
        } catch (e) {
            return { handled: true, step: result.patch.step, error: (e as Error).message };
        }
    }

    return { handled: true, reply: replyText ?? undefined, step: result.patch.step };
}

async function contactWaId(db: Db, contactId: string): Promise<string> {
    const { data } = await db.from("wa_contacts").select("wa_id").eq("id", contactId).single();
    return data?.wa_id ?? "";
}

/**
 * Baja la foto de la URL temporal de Meta (requiere el token) y la sube a
 * Supabase Storage, que sí es una URL estable para el dashboard.
 */
async function storePhoto(
    db: Db,
    metaUrl: string,
    mime: string,
    reviewId: string
): Promise<string | null> {
    try {
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        if (!token) return null;

        const res = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());

        const ext = mime.includes("png") ? "png"
            : mime.includes("mp4") ? "mp4"
            : mime.includes("3gpp") ? "3gp"
            : mime.includes("webp") ? "webp"
            : "jpg";
        const path = `${reviewId}/${Date.now()}.${ext}`;

        // El bucket se crea en el primer uso. Acepta fotos y videos (WhatsApp
        // manda video/mp4 o video/3gpp, hasta ~16MB).
        const { data: buckets } = await db.storage.listBuckets();
        if (!buckets?.some(b => b.name === PHOTO_BUCKET)) {
            await db.storage.createBucket(PHOTO_BUCKET, {
                public: true,
                fileSizeLimit: 50 * 1024 * 1024,
                allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/3gpp"],
            });
        }

        const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, buf, {
            contentType: mime,
            upsert: false,
        });
        if (error) return null;

        const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
        return data.publicUrl;
    } catch {
        return null;
    }
}
