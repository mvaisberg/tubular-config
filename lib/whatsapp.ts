/**
 * Cliente de WhatsApp Cloud API (Meta directo, sin BSP).
 *
 * Config en .env.local:
 *   WHATSAPP_PHONE_NUMBER_ID   ID del número emisor (no el número en sí)
 *   WHATSAPP_WABA_ID           ID de la cuenta de WhatsApp Business
 *   WHATSAPP_ACCESS_TOKEN      token permanente (system user), NO el temporal de 24 h
 *   WHATSAPP_VERIFY_TOKEN      string inventado, se pega igual en el panel de Meta
 *   WHATSAPP_APP_SECRET        secreto de la app, para validar la firma del webhook
 *   WHATSAPP_GRAPH_VERSION     opcional, default abajo
 */
import crypto from "node:crypto";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** Ventana de servicio de WhatsApp: 24 h desde el último mensaje del cliente. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isConfigured(): boolean {
    return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function requireConfig() {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !token) {
        throw new Error(
            "WhatsApp no configurado: faltan WHATSAPP_PHONE_NUMBER_ID y/o WHATSAPP_ACCESS_TOKEN en .env.local"
        );
    }
    return { phoneNumberId, token };
}

/**
 * ¿Se puede mandar un mensaje libre (no plantilla)?
 * Fuera de la ventana Meta rechaza cualquier cosa que no sea plantilla aprobada.
 */
export function isWithinServiceWindow(lastInboundAt: string | Date | null | undefined): boolean {
    if (!lastInboundAt) return false;
    const ts = typeof lastInboundAt === "string" ? Date.parse(lastInboundAt) : lastInboundAt.getTime();
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < SERVICE_WINDOW_MS;
}

/**
 * Normaliza un teléfono argentino al formato que espera Meta: E.164 sin '+'.
 *
 * WhatsApp identifica a los números argentinos SIN el 9 de celular (5411...),
 * aunque para llamar se use 54911... Se saca el 9 después del 54 para que el
 * wa_id coincida con el que devuelve el webhook.
 */
export function normalizeArPhone(raw: string): string | null {
    let d = (raw || "").replace(/\D/g, "");
    if (!d) return null;

    if (d.startsWith("00")) d = d.slice(2);
    // Sin código de país: asumir Argentina.
    if (!d.startsWith("54")) {
        d = d.replace(/^0/, "");           // 011... → 11...
        d = d.replace(/^(\d{2,4})15/, "$1"); // 1115... → 11...
        d = "54" + d;
    }
    // 549XXXX → 54XXXX (Meta no usa el 9 en el wa_id)
    if (d.startsWith("549")) d = "54" + d.slice(3);

    // AR: 54 + área(2-4) + abonado → 12 dígitos típicos. Rango tolerante.
    if (d.length < 11 || d.length > 15) return null;
    return d;
}

async function graphPost(path: string, payload: unknown) {
    const { token } = requireConfig();
    const res = await fetch(`${GRAPH_BASE}/${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = (json as { error?: { message?: string; code?: number } }).error;
        throw new WhatsAppError(err?.message || `Graph API ${res.status}`, err?.code, json);
    }
    return json as { messages?: Array<{ id: string }> };
}

export class WhatsAppError extends Error {
    code?: number;
    payload?: unknown;
    constructor(message: string, code?: number, payload?: unknown) {
        super(message);
        this.name = "WhatsAppError";
        this.code = code;
        this.payload = payload;
    }
}

/** Mensaje de texto libre. Sólo válido dentro de la ventana de 24 h. */
export async function sendText(to: string, body: string): Promise<string> {
    const { phoneNumberId } = requireConfig();
    const res = await graphPost(`${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body },
    });
    return res.messages?.[0]?.id ?? "";
}

/**
 * Mensaje por plantilla aprobada. Es la única vía fuera de la ventana de 24 h.
 * `variables` llena los {{1}}, {{2}}... del body, en orden.
 */
export async function sendTemplate(
    to: string,
    templateName: string,
    language: string,
    variables: string[] = []
): Promise<string> {
    const { phoneNumberId } = requireConfig();
    const components = variables.length
        ? [{ type: "body", parameters: variables.map(v => ({ type: "text", text: v })) }]
        : undefined;

    const res = await graphPost(`${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
            name: templateName,
            language: { code: language },
            ...(components ? { components } : {}),
        },
    });
    return res.messages?.[0]?.id ?? "";
}

/** Marca un entrante como leído (los tildes azules del lado del cliente). */
export async function markAsRead(waMessageId: string): Promise<void> {
    const { phoneNumberId } = requireConfig();
    await graphPost(`${phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: waMessageId,
    });
}

/**
 * Valida la firma del webhook (X-Hub-Signature-256).
 *
 * El endpoint es público: sin esto cualquiera podría inyectar mensajes falsos
 * en la bandeja. Compara en tiempo constante para no filtrar el secreto.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (!appSecret) return false;
    if (!signatureHeader?.startsWith("sha256=")) return false;

    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody, "utf-8").digest("hex");
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Trae la URL temporal de descarga de un media entrante (imagen, audio, etc). */
export async function getMediaUrl(mediaId: string): Promise<{ url: string; mime: string } | null> {
    const { token } = requireConfig();
    const res = await fetch(`${GRAPH_BASE}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json() as { url?: string; mime_type?: string };
    if (!json.url) return null;
    return { url: json.url, mime: json.mime_type || "application/octet-stream" };
}
