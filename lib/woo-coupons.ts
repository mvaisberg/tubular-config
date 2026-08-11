/**
 * Cupones de WooCommerce para el sistema de reviews.
 *
 * Cuando un cliente manda la foto se le emite un cupón personal, de un solo uso
 * y con vencimiento. Se crea vía la REST API de Woo con las credenciales que ya
 * usa el sync de órdenes.
 */

export interface CouponResult {
    code: string;
    id: number;
    expiresAt: string;
}

function wooAuth() {
    const apiUrl = process.env.WOO_API_URL;
    const key = process.env.WOO_CONSUMER_KEY;
    const secret = process.env.WOO_CONSUMER_SECRET;
    if (!apiUrl || !key || !secret) {
        throw new Error("WooCommerce no configurado: faltan WOO_API_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET");
    }
    return {
        baseUrl: apiUrl.replace(/\/$/, ""),
        auth: Buffer.from(`${key}:${secret}`).toString("base64"),
    };
}

/**
 * Código legible y difícil de adivinar: TUBU-REV-XXXX.
 * Se evitan caracteres ambiguos (0/O, 1/I/L) porque el cliente lo tipea a mano.
 */
export function generateCouponCode(prefix = "TUBU-REV"): string {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let suffix = "";
    for (let i = 0; i < 5; i++) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `${prefix}-${suffix}`;
}

/**
 * Crea el cupón en WooCommerce.
 *
 * usage_limit=1 e individual_use=true: es personal e intransferible, y no se
 * puede combinar con otras promos. Si el código ya existiera (colisión), Woo
 * devuelve error y se reintenta con otro.
 */
export async function createReviewCoupon(
    discountPercent: number,
    daysValid: number,
    description = "Cupón por review con foto"
): Promise<CouponResult> {
    const { baseUrl, auth } = wooAuth();

    const expires = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);
    const dateExpires = expires.toISOString().slice(0, 10); // Woo espera YYYY-MM-DD

    let lastError = "";
    // Hasta 3 intentos por si el código sale repetido.
    for (let attempt = 0; attempt < 3; attempt++) {
        const code = generateCouponCode();

        const res = await fetch(`${baseUrl}/coupons`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                code,
                discount_type: "percent",
                amount: String(discountPercent),
                individual_use: true,
                usage_limit: 1,
                date_expires: dateExpires,
                description,
                exclude_sale_items: false,
            }),
            cache: "no-store",
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok) {
            const created = json as { id: number; code: string };
            return { code: created.code, id: created.id, expiresAt: dateExpires };
        }

        const err = json as { code?: string; message?: string };
        lastError = err.message || `HTTP ${res.status}`;
        // Sólo reintentar ante colisión de código.
        if (err.code !== "woocommerce_rest_coupon_code_already_exists") break;
    }

    throw new Error(`No se pudo crear el cupón: ${lastError}`);
}

/** Borra un cupón. Se usa para limpiar los de prueba. */
export async function deleteCoupon(id: number): Promise<boolean> {
    const { baseUrl, auth } = wooAuth();
    const res = await fetch(`${baseUrl}/coupons/${id}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Basic ${auth}` },
        cache: "no-store",
    });
    return res.ok;
}
