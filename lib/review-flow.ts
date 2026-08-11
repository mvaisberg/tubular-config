/**
 * Máquina de estados del flujo de reviews por WhatsApp.
 *
 * Es una función PURA: recibe el estado actual y el mensaje entrante, y devuelve
 * qué contestar y cómo queda el estado. No toca red ni base de datos, así que se
 * puede simular la conversación entera sin credenciales de Meta.
 *
 * El flujo tolera que el cliente conteste cualquier cosa en cualquier orden: si
 * en el primer mensaje ya manda "5 estrellas, buenísimo", se saltea pasos.
 */

export type ReviewStep =
    | "queued"
    | "sent"
    | "awaiting_rating"
    | "awaiting_comment"
    | "awaiting_photo"
    | "completed"
    | "declined"
    | "expired";

export interface ReviewState {
    step: ReviewStep;
    rating: number | null;
    comment: string | null;
    photo_count: number;
    prompt_count: number;
}

export interface InboundMessage {
    /** Tipo del mensaje de WhatsApp. */
    type: string;
    /** Texto (o caption, si vino con la foto). */
    body: string;
    /** true si el mensaje trae una imagen adjunta. */
    hasImage: boolean;
}

export interface FlowPatch {
    step?: ReviewStep;
    rating?: number;
    comment?: string;
    addPhoto?: boolean;
    responded?: boolean;
    incrementPrompt?: boolean;
    resetPrompt?: boolean;
}

export interface FlowResult {
    /** Texto a enviar. null = no contestar nada. */
    reply: string | null;
    patch: FlowPatch;
    /** Emitir el cupón de descuento y adjuntarlo a la respuesta. */
    issueCoupon: boolean;
    /** Guardar la imagen del mensaje en storage. */
    savePhoto: boolean;
}

/** Cuántas veces se repregunta lo mismo antes de dejar de insistir. */
const MAX_PROMPTS = 2;

const OPT_OUT = /\b(baja|desuscribir|no\s*molest|stop|dejen?\s*de\s*escribir|no\s*quiero\s*recibir)\b/i;
const DECLINE = /\b(no|nop|paso|ahora\s*no|m[aá]s\s*tarde|despu[eé]s|listo|nada\s*m[aá]s|gracias\s*no)\b/i;

const WORD_NUMBERS: Record<string, number> = {
    uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
};

/**
 * Saca una puntuación 1-5 de un texto libre.
 * Acepta: "5", "5/5", "5 estrellas", "⭐⭐⭐⭐⭐", "cinco".
 * Devuelve null si no hay nada interpretable como puntuación.
 */
export function parseRating(text: string): number | null {
    if (!text) return null;
    const t = text.trim().toLowerCase();

    // Estrellas como emoji: contar cuántas hay.
    const stars = (t.match(/[⭐★✩🌟]/gu) || []).length;
    if (stars >= 1 && stars <= 5) return stars;

    // "5/5", "4 de 5"
    const outOf = t.match(/([1-5])\s*(?:\/|\s+de\s+)\s*5/);
    if (outOf) return Number(outOf[1]);

    // Número suelto 1-5. Se exige que sea token propio para no agarrar el "5"
    // de "500" ni de un número de pedido.
    const digit = t.match(/(?:^|[^\d])([1-5])(?:[^\d]|$)/);
    if (digit) {
        // Descartar si el texto es claramente otra cosa con números largos.
        if (!/\d{3,}/.test(t)) return Number(digit[1]);
    }

    // Número escrito.
    for (const [word, n] of Object.entries(WORD_NUMBERS)) {
        if (new RegExp(`\\b${word}\\b`).test(t)) return n;
    }

    return null;
}

export function isOptOut(text: string): boolean {
    return OPT_OUT.test(text || "");
}

/** ¿Está diciendo que no quiere seguir, sin llegar a pedir la baja? */
function isDecline(text: string): boolean {
    const t = (text || "").trim();
    if (!t) return false;
    // "no" solo, o frases cortas de rechazo. Si escribió mucho, es un comentario.
    if (t.length > 40) return false;
    return DECLINE.test(t);
}

// ── Copys ────────────────────────────────────────────────────────────────────
// El disparo inicial NO está acá: ese sale por plantilla aprobada de Meta.
// Todo lo de abajo viaja como texto libre dentro de la ventana de 24 h.

const ASK_RATING =
    "¡Gracias por responder! 🙌\n\n" +
    "¿Del 1 al 5, cuántas estrellas le pondrías a tu compra?\n" +
    "Respondé solo con el número.";

const ASK_RATING_RETRY =
    "Perdón, no te entendí. Mandame un número del 1 al 5 ⭐\n" +
    "(1 = muy malo, 5 = excelente)";

const ASK_COMMENT = (rating: number) =>
    rating >= 4
        ? `¡${"⭐".repeat(rating)} Gracias! Nos alegra un montón.\n\n¿Nos contás en una o dos líneas qué fue lo que más te gustó?`
        : `Gracias por la sinceridad (${rating}/5).\n\n¿Nos contás qué salió mal? Lo leemos en serio y nos sirve para mejorar.`;

const ASK_PHOTO = (discount: number) =>
    "¡Gracias por el comentario! 🙏\n\n" +
    `Última cosa: ¿nos mandás una foto del mueble en tu casa? ` +
    `Te damos un *${discount}% OFF* para tu próxima compra.`;

const THANKS_NO_PHOTO =
    "¡Gracias igual por tu tiempo! Cualquier cosa que necesites, escribinos por acá. 💙";

const THANKS_WITH_COUPON = (code: string, discount: number, days: number) =>
    "¡Genial, gracias por la foto! 📸\n\n" +
    `Acá va tu cupón de *${discount}% OFF*: *${code}*\n` +
    `Válido por ${days} días. Usalo en tubular.com.ar 💙`;

const OPTED_OUT =
    "Listo, no te escribimos más por este tema. ¡Gracias igual! 💙";

const GAVE_UP =
    "Te dejo tranquilo/a. Si más adelante querés dejarnos tu opinión, escribinos cuando quieras. 💙";

export interface FlowConfig {
    discountPercent: number;
    couponDaysValid: number;
    /** Código de cupón ya generado, si en este paso corresponde entregarlo. */
    couponCode?: string;
}

/**
 * Decide el próximo paso.
 *
 * `state` es cómo está el review ANTES de este mensaje.
 * `msg` es lo que acaba de mandar el cliente.
 */
export function advanceReviewFlow(
    state: ReviewState,
    msg: InboundMessage,
    config: FlowConfig
): FlowResult {
    const text = msg.body || "";
    const none: FlowResult = { reply: null, patch: {}, issueCoupon: false, savePhoto: false };

    // Estados terminales: no se contesta más.
    if (["completed", "declined", "expired", "queued"].includes(state.step)) {
        return none;
    }

    // Pedido de baja: corta en cualquier momento.
    if (isOptOut(text)) {
        return {
            reply: OPTED_OUT,
            patch: { step: "declined", responded: true },
            issueCoupon: false,
            savePhoto: false,
        };
    }

    switch (state.step) {
        // Salió la plantilla y contestó por primera vez.
        case "sent": {
            // Si ya vino con la puntuación en el primer mensaje, se saltea un paso.
            const rating = parseRating(text);
            if (rating !== null) {
                return {
                    reply: ASK_COMMENT(rating),
                    patch: { step: "awaiting_comment", rating, responded: true, resetPrompt: true },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            return {
                reply: ASK_RATING,
                patch: { step: "awaiting_rating", responded: true, resetPrompt: true },
                issueCoupon: false,
                savePhoto: false,
            };
        }

        case "awaiting_rating": {
            const rating = parseRating(text);
            if (rating !== null) {
                return {
                    reply: ASK_COMMENT(rating),
                    patch: { step: "awaiting_comment", rating, resetPrompt: true },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            if (isDecline(text)) {
                return {
                    reply: THANKS_NO_PHOTO,
                    patch: { step: "completed" },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            // No se entendió: repreguntar, pero sin insistir para siempre.
            if (state.prompt_count >= MAX_PROMPTS) {
                return {
                    reply: GAVE_UP,
                    patch: { step: "completed" },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            return {
                reply: ASK_RATING_RETRY,
                patch: { incrementPrompt: true },
                issueCoupon: false,
                savePhoto: false,
            };
        }

        case "awaiting_comment": {
            // Si en vez de comentar manda la foto directo, se acepta igual.
            if (msg.hasImage) {
                return {
                    reply: THANKS_WITH_COUPON(config.couponCode ?? "", config.discountPercent, config.couponDaysValid),
                    patch: { step: "completed", addPhoto: true, comment: text || undefined },
                    issueCoupon: true,
                    savePhoto: true,
                };
            }
            if (isDecline(text)) {
                return {
                    reply: ASK_PHOTO(config.discountPercent),
                    patch: { step: "awaiting_photo", resetPrompt: true },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            if (text.trim().length === 0) {
                return none;
            }
            return {
                reply: ASK_PHOTO(config.discountPercent),
                patch: { step: "awaiting_photo", comment: text.trim(), resetPrompt: true },
                issueCoupon: false,
                savePhoto: false,
            };
        }

        case "awaiting_photo": {
            if (msg.hasImage) {
                return {
                    reply: THANKS_WITH_COUPON(config.couponCode ?? "", config.discountPercent, config.couponDaysValid),
                    patch: { step: "completed", addPhoto: true },
                    issueCoupon: true,
                    savePhoto: true,
                };
            }
            if (isDecline(text)) {
                return {
                    reply: THANKS_NO_PHOTO,
                    patch: { step: "completed" },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            if (state.prompt_count >= MAX_PROMPTS) {
                return {
                    reply: THANKS_NO_PHOTO,
                    patch: { step: "completed" },
                    issueCoupon: false,
                    savePhoto: false,
                };
            }
            return {
                reply: `Si te queda a mano, mandanos la foto y te paso el ${config.discountPercent}% OFF 📸`,
                patch: { incrementPrompt: true },
                issueCoupon: false,
                savePhoto: false,
            };
        }

        default:
            return none;
    }
}
