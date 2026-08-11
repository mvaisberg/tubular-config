/**
 * Agente conversacional del flujo de reviews (Claude).
 *
 * Reemplaza a la máquina de estados rígida cuando hay ANTHROPIC_API_KEY: interpreta
 * lo que el cliente manda en cualquier orden y formato (puntuación + comentario +
 * foto todo junto, de a pedazos, con typos, etc.), registra los datos y responde
 * con tono humano. Si la API falla o no hay key, el procesador cae a la máquina
 * de estados (`advanceReviewFlow`) y el flujo no se corta.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ReviewState, InboundMessage, FlowResult, FlowConfig } from "@/lib/review-flow";

export interface ConversationTurn {
    direction: "inbound" | "outbound";
    body: string;
}

interface AgentDecision {
    reply: string | null;
    rating: number | null;
    comment_fragment: string | null;
    media_is_relevant: boolean;
    wants_optout: boolean;
    done: boolean;
}

const DECISION_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["reply", "rating", "comment_fragment", "media_is_relevant", "wants_optout", "done"],
    properties: {
        reply: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Mensaje a enviar al cliente por WhatsApp. null si no corresponde contestar nada.",
        },
        rating: {
            anyOf: [{ type: "integer", enum: [1, 2, 3, 4, 5] }, { type: "null" }],
            description: "Puntuación 1-5 detectada en ESTE mensaje (número, estrellas, palabras tipo 'excelente'≈5, 'malo'≈2). null si no hay.",
        },
        comment_fragment: {
            anyOf: [{ type: "string" }, { type: "null" }],
            description: "Texto del cliente que constituye opinión sobre el producto/experiencia, citado casi textual. null si el mensaje no aporta opinión.",
        },
        media_is_relevant: {
            type: "boolean",
            description: "true si la foto/video de este mensaje parece ser del mueble/pedido (por contexto). false si no hay media o es claramente otra cosa.",
        },
        wants_optout: {
            type: "boolean",
            description: "true si pide que no le escriban más / darse de baja.",
        },
        done: {
            type: "boolean",
            description: "true si la conversación de review terminó (ya dio todo lo que iba a dar, o cortó amablemente, o se le entregó el cupón).",
        },
    },
} as const;

const SYSTEM_PROMPT = `Sos parte del equipo de Tubular (tubular.com.ar), una marca argentina de muebles modulares de acero. Estás respondiendo WhatsApp desde el número oficial de la marca. Nunca digas ni insinúes que sos un sistema automático, un bot o una IA — sos simplemente "el equipo de Tubular".

CONTEXTO: le mandamos al cliente un mensaje pidiéndole su opinión sobre el mueble que recibió. Tu trabajo es conversar con naturalidad y, en el camino, recolectar hasta tres cosas:
1. Puntuación de 1 a 5
2. Un comentario/opinión
3. Foto y/o video del mueble en su casa → a cambio se le regala un cupón de descuento

CÓMO INTERPRETAR LO QUE MANDA:
- La gente manda todo junto, desordenado o de a pedazos: "5 estrellas! hermoso el rack" + foto en un solo mensaje, o solo una foto sin texto, o primero la foto y después la opinión. Registrá TODO lo que venga en cada mensaje, en cualquier orden.
- Puntuación: aceptá números, estrellas (⭐), "5/5", "un 10" (=5), y palabras ("excelente"/"espectacular"≈5, "muy bueno"≈4, "zafa"/"más o menos"≈3, "malo"≈2, "horrible"≈1). Si es ambiguo, no inventes: dejá rating en null.
- Comentario: cualquier opinión sobre el producto o la experiencia cuenta, aunque sea corta. No cuentan saludos, preguntas o "ok".
- Si manda un audio o algo que no podés procesar, pedile con onda que te lo escriba.

ESTILO (crítico para no parecer bot):
- Español argentino, voseo, tono cercano de marca chica. Mensajes CORTOS, como chatea una persona (1-3 líneas).
- EMOJIS: casi nunca. Como máximo uno cada tres o cuatro mensajes, y solo si suma. Un emoji en cada mensaje delata a un bot. Ante la duda, sin emoji.
- PUNTUACIÓN: nunca uses signos de apertura ¡ ni ¿. Escribí como se chatea de verdad, solo con el signo de cierre: "que bueno!", "te llegó bien?", "del 1 al 5 cuánto le pondrías?".
- Referenciá específicamente lo que el cliente dijo o mandó ("qué bueno que le encontraste lugar en el living") en vez de frases genéricas.
- Variá las formas de decir las cosas; nunca repitas la misma frase que ya está en el historial.
- Nada de listas, títulos, negritas ni formato corporativo.
- No pidas datos que ya están registrados (te paso el estado). No hagas dos preguntas en un mensaje.
- Insistí como máximo UNA vez por dato. Si el estado muestra prompt_count >= 2 o el cliente no engancha, cerrá agradeciendo sin pedir más nada.

SITUACIONES:
- Puntuación baja (1-3): empatizá en serio, preguntá qué salió mal, sin tono comercial. No festejes ni pidas foto con entusiasmo; el equipo va a leer su caso.
- Foto/video del mueble: agradecé y entregá el cupón EXACTAMENTE con el código que te paso en el contexto (si hay). Mencioná el porcentaje, la validez en días y que se usa en tubular.com.ar.
- Si la imagen claramente no es el mueble (meme, captura de pantalla, otra cosa): media_is_relevant=false y seguí la charla sin dar cupón.
- Si pregunta otra cosa (estado de un pedido, precios, soporte): respondé breve que se lo confirma el equipo por este mismo chat, sin inventar NADA (ni precios, ni plazos, ni stock), y retomá suave o cerrá.
- Si pide que no lo molesten más: wants_optout=true, despedite amable en una línea.
- Cuando ya diste el cupón o el cliente cerró la charla: done=true y no sigas pidiendo cosas.
- Si flujo_terminado=true en el contexto: la encuesta ya se completó. Respondé como una persona del equipo que sigue la charla: si ofrece mandar más fotos o un video, decile que sí con ganas (sirve un montón); si manda más media del mueble, agradecé (media_is_relevant=true) — y si el contexto trae un cupón sin entregar, entregáselo ahí. No vuelvas a pedir puntuación ni comentario. done=true salvo que quede algo pendiente de verdad.

Nunca inventes información de productos, precios, tiempos ni promociones que no estén en el contexto.`;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    if (!client) client = new Anthropic();
    return client;
}

export function agentAvailable(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Corre un turno del agente y lo mapea al mismo FlowResult que devuelve la máquina
 * de estados, para que el procesador no tenga dos caminos distintos de persistencia.
 * Tira excepción si la API falla — el caller decide el fallback.
 */
export async function agentAdvanceReviewFlow(
    state: ReviewState,
    msg: InboundMessage,
    config: FlowConfig,
    history: ConversationTurn[],
    customerName: string | null,
    flowClosed = false
): Promise<FlowResult> {
    const anthropic = getClient();
    if (!anthropic) throw new Error("ANTHROPIC_API_KEY no configurada");

    const hasMedia = msg.hasImage || Boolean(msg.hasVideo);

    const context = {
        cliente: customerName || "desconocido",
        flujo_terminado: flowClosed,
        estado_actual: {
            puntuacion: state.rating,
            comentario: state.comment,
            fotos_o_videos_recibidos: state.photo_count,
            repreguntas_hechas: state.prompt_count,
        },
        cupon: config.couponCode
            ? { codigo: config.couponCode, descuento_pct: config.discountPercent, dias_validez: config.couponDaysValid }
            : null,
        oferta_por_foto: { descuento_pct: config.discountPercent, dias_validez: config.couponDaysValid },
        mensaje_entrante: {
            texto: msg.body || null,
            trae_imagen: msg.hasImage,
            trae_video: Boolean(msg.hasVideo),
        },
    };

    const historyText = history
        .map(t => `${t.direction === "inbound" ? "CLIENTE" : "TUBULAR"}: ${t.body}`)
        .join("\n");

    const response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 1000,
        output_config: {
            effort: "low",
            format: { type: "json_schema", schema: DECISION_SCHEMA as unknown as Record<string, unknown> },
        },
        system: SYSTEM_PROMPT,
        messages: [
            {
                role: "user",
                content:
                    `HISTORIAL RECIENTE DE LA CONVERSACIÓN:\n${historyText || "(sin mensajes previos)"}\n\n` +
                    `CONTEXTO Y ESTADO:\n${JSON.stringify(context, null, 2)}\n\n` +
                    `El cliente acaba de mandar el mensaje entrante del contexto. Decidí la respuesta y qué datos registrar.`,
            },
        ],
    });

    if (response.stop_reason === "refusal") {
        throw new Error("agente: refusal");
    }

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("agente: sin salida");
    const decision = JSON.parse(textBlock.text) as AgentDecision;

    // ── Mapeo a FlowResult ──────────────────────────────────────────────────
    const newRating = state.rating == null && decision.rating != null ? decision.rating : undefined;

    // El comentario se acumula: si ya había algo y el cliente agrega, se concatena.
    let comment: string | undefined;
    if (decision.comment_fragment) {
        comment = state.comment
            ? `${state.comment}\n${decision.comment_fragment}`.slice(0, 2000)
            : decision.comment_fragment.slice(0, 2000);
    }

    const saveMedia = hasMedia && decision.media_is_relevant;

    // Paso resultante: terminales primero, si no se deriva de lo que falta.
    // Un flujo ya cerrado no se reabre: los follow-ups quedan en completed.
    let step: ReviewState["step"];
    if (decision.wants_optout) step = "declined";
    else if (decision.done || flowClosed) step = "completed";
    else if ((newRating ?? state.rating) == null) step = "awaiting_rating";
    else if ((comment ?? state.comment) == null) step = "awaiting_comment";
    else step = "awaiting_photo";

    return {
        reply: decision.reply,
        patch: {
            step,
            ...(newRating !== undefined ? { rating: newRating } : {}),
            ...(comment !== undefined ? { comment } : {}),
            ...(saveMedia ? { addPhoto: true } : {}),
            responded: true,
            // El agente decide solo cuándo dejar de insistir; el contador queda como telemetría.
            incrementPrompt: !decision.done && !decision.wants_optout,
        },
        issueCoupon: saveMedia && Boolean(config.couponCode),
        savePhoto: saveMedia,
    };
}
