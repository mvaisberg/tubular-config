/**
 * Decide si una review se publica sola en la web.
 *
 * Regla: 5 estrellas + comentario inequívocamente positivo → se publica.
 * Ante CUALQUIER duda (una queja aunque sea menor, un "pero", un pedido
 * pendiente, texto ambiguo o demasiado corto) queda sin publicar para que el
 * equipo la revise a mano.
 */
import Anthropic from "@anthropic-ai/sdk";

// Números internos (pruebas del equipo): nunca se publican.
const TEST_WA_IDS = new Set(["5491169965506", "5491158505108"]);

const SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["publish", "reason"],
    properties: {
        publish: {
            type: "boolean",
            description: "true SOLO si el comentario es inequívocamente positivo y publicable tal cual.",
        },
        reason: { type: "string", description: "Motivo en pocas palabras." },
    },
} as const;

const SYSTEM = `Sos el editor de reseñas de Tubular (muebles de diseño). Decidís si una reseña de 5 estrellas se publica automáticamente en la web.

Respondé publish=true si se cumple todo:
- El comentario habla bien del producto, del servicio o de la experiencia.
- No menciona ningún problema, defecto, demora, queja ni reclamo — ni siquiera menor o dicho con amabilidad ("una repisa hizo panza pero…").
- No tiene condiciones ni cosas pendientes ("por ahora", "espero que", "falta que", "me quedó pendiente").
- Se entiende leyéndolo solo, sin la conversación de WhatsApp alrededor.

Un elogio corto y claro SÍ se publica ("Todo excelente!!", "super biennn, divino e impecable"): no exijas un testimonio largo ni detallado.
NO se publica si el texto es un fragmento suelto que no se entiende ("todo perfecto 5 ambos"), una pregunta, o si menciona cualquier pero.

Ante duda real sobre si hay una queja escondida, publish=false: es preferible dejar una buena reseña sin publicar que publicar una con un pero.`;

export interface AutoPublishDecision {
    publish: boolean;
    reason: string;
}

export async function shouldAutoPublish(args: {
    rating: number | null;
    comment: string | null;
    waId?: string | null;
}): Promise<AutoPublishDecision> {
    const comment = (args.comment ?? "").trim();

    if (args.waId && TEST_WA_IDS.has(args.waId)) return { publish: false, reason: "contacto de prueba interno" };
    if (args.rating !== 5) return { publish: false, reason: "no es 5 estrellas" };
    if (comment.length < 15) return { publish: false, reason: "comentario demasiado corto" };
    if (!process.env.ANTHROPIC_API_KEY) return { publish: false, reason: "sin API key para evaluar" };

    try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const res = await client.messages.create({
            model: "claude-opus-5",
            max_tokens: 300,
            system: SYSTEM,
            messages: [{ role: "user", content: `Reseña (5 estrellas):\n"""${comment}"""` }],
            output_config: {
                effort: "low",
                format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
            },
        } as never) as unknown as { content: { type: string; text?: string }[] };

        const text = res.content.find(c => c.type === "text")?.text ?? "{}";
        const parsed = JSON.parse(text) as AutoPublishDecision;
        return { publish: !!parsed.publish, reason: parsed.reason || "" };
    } catch (e) {
        // Si falla la evaluación, no se publica: queda para revisión manual.
        return { publish: false, reason: "no se pudo evaluar: " + (e as Error).message.slice(0, 80) };
    }
}
